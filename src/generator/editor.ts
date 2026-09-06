import {
    applyShape,
    canAddLayer,
    canRemoveLayer,
    clampWidth,
    cloneModel,
    insertLayer,
    MAX_WIDTH,
    MIN_WIDTH,
    moveLayer,
    PRESETS,
    removeLayer,
    reorderLayer,
    SHAPE_LABELS,
    SHAPES,
    type PyramidModel,
    type ShapeName,
} from './model';
import {
    edgeGeometry,
    effectiveLayerGradient,
    effectiveLayerPattern,
    layerHeightFor,
    layerPolygonPoints,
    layerShapePath,
    renderPyramidSvg,
    unitFor,
} from './render';
import { getActiveStyle } from './styleState';
import type { PatternName } from './styles/types';
import { isDarkMode } from './theme';

export interface EditorHost {
    getModel(): PyramidModel;
    /** A finished change: push to history, re-render everything, sync URL. */
    onCommit(): void;
    /** An in-progress change (dragging, live typing): sync the URL only. */
    onLive(): void;
    undo(): void;
    redo(): void;
    canUndo(): boolean;
    canRedo(): boolean;
}

export interface PyramidEditor {
    /** Rebuild canvas, selection UI and toolbar from the current model. */
    render(): void;
    deleteSelected(): boolean;
    clearSelection(): void;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

const PATTERN_LABELS: Record<PatternName, string> = {
    none: 'Plain (no fill)',
    diag45: 'Diagonal hatch',
    'diag-45': 'Reverse diagonal hatch',
    cross: 'Cross hatch',
    dots: 'Dots',
    horizontal: 'Horizontal lines',
};

function truncate(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars - 1).trimEnd() + '…';
}

/**
 * The WYSIWYG editor: a formatting toolbar directly above the pyramid canvas, click-to-select
 * layers, drag handles on the selected layer's edges for widths, vertical drag-and-drop to
 * reorder layers, inline "+" handles to insert layers, and single-click text editing right
 * where it is displayed.
 */
export function createEditor(
    toolbarEl: HTMLElement,
    canvasEl: HTMLElement,
    host: EditorHost
): PyramidEditor {
    let selected: number | null = null;
    let svg: SVGSVGElement | null = null;
    let widthDrag: { edge: number; side: 'left' | 'right' } | null = null;
    let hoveredLayer: number | null = null;
    let activeInline: { commit: () => void } | null = null;
    let layerDrag: { from: number; insertAt: number; startY: number; started: boolean } | null =
        null;

    // --- Canvas event delegation (attached once; canvas content is rebuilt per render) ---
    canvasEl.addEventListener('dblclick', onCanvasDoubleClick);
    canvasEl.addEventListener('pointerdown', onPointerDown);
    canvasEl.addEventListener('pointerover', onCanvasPointerOver);

    function model(): PyramidModel {
        return host.getModel();
    }

    /**
     * Resolve the element under the cursor from coordinates. The DOM is rebuilt whenever an
     * edit commits, so the original event target may already be detached.
     */
    function hitElement(event: MouseEvent): Element | null {
        return document.elementFromPoint(event.clientX, event.clientY);
    }

    function onCanvasDoubleClick(event: MouseEvent): void {
        if (widthDrag !== null || activeInline !== null || layerDrag !== null) return;
        const target = hitElement(event);
        const polygon = target?.closest('path[data-layer-index]');
        if (polygon !== null && polygon !== undefined) {
            startInlineEdit('label', Number(polygon.getAttribute('data-layer-index')));
        }
    }

    /**
     * Track which layer the pointer is over (layer body, chip, label or legend notes row).
     * The hover outline is drawn inside the editing-UI group, which always sits above every
     * layer — no reordering needed, no occlusion by neighboring layers.
     */
    function onCanvasPointerOver(event: PointerEvent): void {
        if (svg === null) return;
        const target = event.target as Element;
        let index: number | null = null;
        const hit = target.closest('[data-layer-index]');
        if (
            hit !== null &&
            hit.closest('.editing-ui') === null &&
            (hit.matches('polygon, path') ||
                hit.matches('[data-edit-field]') ||
                hit.matches('rect[data-label-chip]'))
        ) {
            index = Number(hit.getAttribute('data-layer-index'));
        }
        if (index === hoveredLayer) return;
        hoveredLayer = index;
        updateHoverOutline();
    }

    function updateHoverOutline(): void {
        if (svg === null) return;
        const ui = svg.querySelector('.editing-ui');
        if (ui === null) return;
        const m = model();
        const show =
            hoveredLayer !== null && hoveredLayer < m.layers.length && hoveredLayer !== selected;
        let group = ui.querySelector('g.hover-ui');
        if (!show) {
            group?.remove();
            return;
        }
        if (group === null) {
            group = document.createElementNS(SVG_NS, 'g');
            group.setAttribute('class', 'hover-ui');
            // Below the selection handles/tint but above all layer polygons.
            ui.insertBefore(group, ui.firstChild);
        }
        group.textContent = '';
        const points = layerPolygonPoints(m, hoveredLayer as number, getActiveStyle());
        for (const cls of ['hover-inner', 'hover-outline']) {
            const polygon = document.createElementNS(SVG_NS, 'polygon');
            polygon.setAttribute('class', cls);
            polygon.setAttribute('points', points);
            group.appendChild(polygon);
        }
    }

    // --- Pointer down: selection, inline editing, insert, drag start ----------
    function onPointerDown(event: PointerEvent): void {
        const rawTarget = event.target as Element;

        // 1. Width resize handle drag
        const handle = rawTarget.closest('.width-handle');
        if (handle !== null) {
            event.preventDefault();
            widthDrag = {
                edge: Number(handle.getAttribute('data-edge')),
                side: handle.getAttribute('data-side') === 'left' ? 'left' : 'right',
            };
            // Capture on the persistent canvas so re-renders during the drag are safe.
            canvasEl.setPointerCapture(event.pointerId);
            canvasEl.addEventListener('pointermove', onDragMove);
            canvasEl.addEventListener('pointerup', onDragEnd);
            canvasEl.addEventListener('pointercancel', onDragEnd);
            return;
        }

        // 2. Interactions inside the inline editor itself are the browser's business
        if (rawTarget.closest('.inline-edit') !== null) {
            return;
        }

        // 3. A pending inline edit is committed first, so this same pointer press can open
        //    the next editor / tool in one click.
        if (activeInline !== null) {
            activeInline.commit();
        }

        const target = hitElement(event);
        if (target === null) return;

        // 4. Inline "+" handles: insert a layer at this edge and select it.
        const addHandle = target.closest('.add-layer');
        if (addHandle !== null) {
            event.preventDefault();
            const edge = Number(addHandle.getAttribute('data-add-edge'));
            if (insertLayer(model(), edge)) {
                selected = edge;
                host.onCommit();
            }
            return;
        }

        // 4b. Model-level editable text: title (above) and descriptor (below) the pyramid.
        const modelFieldEl = target.closest(
            '[data-edit-field="title"], [data-edit-field="descriptor"]'
        );
        if (modelFieldEl !== null) {
            startInlineEdit(modelFieldEl.getAttribute('data-edit-field') as 'title' | 'descriptor');
            return;
        }

        const hit = target.closest('[data-layer-index]');
        const next = hit === null ? null : Number(hit.getAttribute('data-layer-index'));

        // 5. Editable text: single click selects the layer and opens the inline editor.
        const fieldEl = hit === null ? null : hit.closest('[data-edit-field]');
        if (fieldEl !== null && next !== null) {
            if (next !== selected) {
                selected = next;
                render();
            }
            startInlineEdit(fieldEl.getAttribute('data-edit-field') as 'label' | 'notes', next);
            return;
        }

        // 6. Layer body: select, and start a potential reorder drag.
        const polygon = target.closest('path[data-layer-index]');
        if (polygon !== null) {
            if (next !== selected) {
                selected = next;
                render();
            }
            const from = Number(polygon.getAttribute('data-layer-index'));
            layerDrag = { from, insertAt: from, startY: event.clientY, started: false };
            canvasEl.setPointerCapture(event.pointerId);
            canvasEl.addEventListener('pointermove', onLayerDragMove);
            canvasEl.addEventListener('pointerup', onLayerDragEnd);
            canvasEl.addEventListener('pointercancel', onLayerDragEnd);
            return;
        }

        // 7. Empty canvas: deselect.
        if (selected !== null) {
            selected = null;
            render();
        }
    }

    function onLayerDragMove(event: PointerEvent): void {
        if (layerDrag === null || svg === null) return;
        if (!layerDrag.started) {
            if (Math.abs(event.clientY - layerDrag.startY) < 6) return;
            layerDrag.started = true;
        }
        const ctm = svg.getScreenCTM();
        if (ctm === null) return;
        const point = svg.createSVGPoint();
        point.x = event.clientX;
        point.y = event.clientY;
        const svgY = point.matrixTransform(ctm.inverse()).y;
        const m = model();
        const style = getActiveStyle();
        const layerHeight = layerHeightFor(m, style);
        const band = Math.floor((svgY - style.layout.padding) / layerHeight);
        let insertAt: number;
        if (band < 0) {
            insertAt = 0;
        } else if (band >= m.layers.length) {
            insertAt = m.layers.length;
        } else {
            const within = svgY - (style.layout.padding + band * layerHeight);
            insertAt = within < layerHeight / 2 ? band : band + 1;
        }
        layerDrag.insertAt = insertAt;
        render();
    }

    function onLayerDragEnd(): void {
        canvasEl.removeEventListener('pointermove', onLayerDragMove);
        canvasEl.removeEventListener('pointerup', onLayerDragEnd);
        canvasEl.removeEventListener('pointercancel', onLayerDragEnd);
        if (layerDrag === null) return;
        const drag = layerDrag;
        layerDrag = null;
        if (!drag.started) {
            return; // plain press without movement; selection was handled on pointerdown
        }
        const m = model();
        const to = drag.insertAt > drag.from ? drag.insertAt - 1 : drag.insertAt;
        if (reorderLayer(m, drag.from, to)) {
            selected = to;
        }
        host.onCommit();
    }

    function onDragMove(event: PointerEvent): void {
        if (widthDrag === null || svg === null) return;
        const ctm = svg.getScreenCTM();
        if (ctm === null) return;
        const point = svg.createSVGPoint();
        point.x = event.clientX;
        point.y = event.clientY;
        const svgPoint = point.matrixTransform(ctm.inverse());
        const style = getActiveStyle();
        const { centerX } = edgeGeometry(model(), widthDrag.edge, style);
        // Signed distance per dragged side: past the horizontal middle the width sticks at 0,
        // mirroring the 100 cap at the other end.
        const distance = widthDrag.side === 'right' ? svgPoint.x - centerX : centerX - svgPoint.x;
        const width = clampWidth((distance * 2) / unitFor(model(), style));
        if (width === model().widths[widthDrag.edge]) return;
        model().widths[widthDrag.edge] = width;
        render();
        host.onLive();
    }

    function onDragEnd(): void {
        if (widthDrag === null) return;
        widthDrag = null;
        canvasEl.removeEventListener('pointermove', onDragMove);
        canvasEl.removeEventListener('pointerup', onDragEnd);
        canvasEl.removeEventListener('pointercancel', onDragEnd);
        host.onCommit();
    }

    /**
     * Update geometry attributes in place (polygons, outline, handles, toolbar numbers)
     * without rebuilding the toolbar DOM — keeps focused inputs alive.
     */
    function updateGeometryLive(): void {
        if (svg === null) return;
        const m = model();
        const style = getActiveStyle();
        m.layers.forEach((_, i) => {
            // Both the fill path and the overlay stroke path share the same geometry.
            const d = layerShapePath(m, i, style);
            svg!.querySelectorAll(`path[data-layer-index="${i}"]`).forEach((shape) => {
                shape.setAttribute('d', d);
            });
        });
        if (selected !== null && selected < m.layers.length) {
            const outline = svg.querySelector('.selection-outline');
            if (outline !== null) {
                outline.setAttribute('points', layerPolygonPoints(m, selected, style));
            }
            const inner = svg.querySelector('.selection-inner');
            if (inner !== null) {
                inner.setAttribute('points', layerPolygonPoints(m, selected, style));
            }
        }
        updateHoverOutline();
        svg.querySelectorAll('.width-handle').forEach((handle) => {
            const element = handle as SVGCircleElement;
            const edge = Number(element.getAttribute('data-edge'));
            const geometry = edgeGeometry(m, edge, style);
            element.setAttribute(
                'cx',
                String(
                    element.getAttribute('data-side') === 'left' ? geometry.leftX : geometry.rightX
                )
            );
            element.setAttribute('cy', String(geometry.y));
        });
        toolbarEl.querySelectorAll<HTMLInputElement>('input[data-width-edge]').forEach((input) => {
            const edge = Number(input.getAttribute('data-width-edge'));
            if (document.activeElement !== input) {
                input.value = String(m.widths[edge] ?? 0);
            }
        });
    }

    // --- Inline text editing (WYSIWYG: edit where you see) ------------------
    function startInlineEdit(
        field: 'label' | 'notes' | 'title' | 'descriptor',
        index?: number
    ): void {
        if (svg === null || activeInline !== null) return;
        const m = model();
        if (index !== undefined && m.layers[index] === undefined) return;
        const target = svg.querySelector(
            index === undefined
                ? `[data-edit-field="${field}"]`
                : `[data-edit-field="${field}"][data-layer-index="${index}"]`
        );
        if (target === null) return;

        const targetRect = target.getBoundingClientRect();
        const canvasRect = canvasEl.getBoundingClientRect();
        // Where the value lives: on the model (title/descriptor) or on a layer (label/notes).
        const store: { get(): string; set(value: string): void } =
            index === undefined
                ? {
                      get: () => m[field as 'title' | 'descriptor'] ?? '',
                      set: (value: string) => {
                          m[field as 'title' | 'descriptor'] = value;
                      },
                  }
                : {
                      get: () => m.layers[index][field as 'label' | 'notes'],
                      set: (value: string) => {
                          m.layers[index][field as 'label' | 'notes'] = value;
                      },
                  };
        const current = store.get();
        const multiline = field === 'notes' || field === 'descriptor';

        const input = document.createElement(multiline ? 'textarea' : 'input');
        input.className = 'inline-edit';
        input.value = current;
        const width = Math.max(multiline ? 240 : 160, targetRect.width + 60);
        input.style.width = `${width}px`;
        // Center the editor on the target text (CSS translate(-50%,-50%) completes the centering).
        input.style.left = `${targetRect.left + targetRect.width / 2 - canvasRect.left + canvasEl.scrollLeft}px`;
        input.style.top = `${targetRect.top + targetRect.height / 2 - canvasRect.top + canvasEl.scrollTop}px`;
        if (multiline) {
            (input as HTMLTextAreaElement).rows = Math.max(
                2,
                Math.min(8, current.split('\n').length + 1)
            );
        }

        let done = false;
        const finish = (commit: boolean): void => {
            if (done) return;
            done = true;
            activeInline = null;
            const value = input.value;
            input.remove();
            if (commit) {
                store.set(value);
                host.onCommit();
            } else {
                render();
            }
        };
        activeInline = { commit: () => finish(true) };

        input.addEventListener('blur', () => finish(true));
        input.addEventListener('keydown', (event: Event) => {
            const keyboardEvent = event as KeyboardEvent;
            keyboardEvent.stopPropagation();
            if (keyboardEvent.key === 'Escape') {
                keyboardEvent.preventDefault();
                finish(false);
            } else if (keyboardEvent.key === 'Enter' && (!multiline || !keyboardEvent.shiftKey)) {
                keyboardEvent.preventDefault();
                finish(true);
            }
        });

        canvasEl.appendChild(input);
        // Defer focus: the mousedown default action (moving focus away) must not immediately
        // blur the just-opened editor. Caret at end — clicking to edit should not select all.
        window.setTimeout(() => {
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
        }, 0);
    }

    // --- Toolbar -------------------------------------------------------------
    function toolButton(text: string, title: string, onClick: () => void): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'tool';
        button.textContent = text;
        button.title = title;
        button.addEventListener('click', onClick);
        return button;
    }

    function divider(): HTMLSpanElement {
        const span = document.createElement('span');
        span.className = 'divider';
        return span;
    }

    function renderToolbar(): void {
        toolbarEl.textContent = '';

        const m = model();
        const hasSelection = selected !== null && selected < m.layers.length;

        const undoButton = toolButton('↶', 'Undo (Ctrl+Z)', () => host.undo());
        undoButton.disabled = !host.canUndo();
        const redoButton = toolButton('↷', 'Redo (Ctrl+Y or Ctrl+Shift+Z)', () => host.redo());
        redoButton.disabled = !host.canRedo();
        toolbarEl.append(undoButton, redoButton, divider());

        const presetSelect = document.createElement('select');
        presetSelect.className = 'tool-select';
        presetSelect.title = 'Replace the entire pyramid with a preset';
        const presetPlaceholder = document.createElement('option');
        presetPlaceholder.value = '';
        presetPlaceholder.textContent = 'Use preset…';
        presetSelect.appendChild(presetPlaceholder);
        PRESETS.forEach((preset, index) => {
            const option = document.createElement('option');
            option.value = String(index);
            option.textContent = preset.name;
            presetSelect.appendChild(option);
        });
        presetSelect.addEventListener('change', () => {
            if (presetSelect.value === '') return;
            // Clone: presets hold static data and the editor mutates models in place.
            const fresh = cloneModel(PRESETS[Number(presetSelect.value)].data);
            m.version = fresh.version;
            m.title = fresh.title;
            m.descriptor = fresh.descriptor;
            m.layers = fresh.layers;
            m.widths = fresh.widths;
            presetSelect.value = '';
            selected = null;
            host.onCommit();
        });

        const shapeSelect = document.createElement('select');
        shapeSelect.className = 'tool-select';
        shapeSelect.title = 'Reshape all edges to a preset';
        const shapePlaceholder = document.createElement('option');
        shapePlaceholder.value = '';
        shapePlaceholder.textContent = 'Apply shape…';
        shapeSelect.appendChild(shapePlaceholder);
        for (const shape of SHAPES) {
            const option = document.createElement('option');
            option.value = shape;
            option.textContent = SHAPE_LABELS[shape];
            shapeSelect.appendChild(option);
        }
        shapeSelect.addEventListener('change', () => {
            const value = shapeSelect.value;
            if (value === '') return;
            applyShape(m, value as ShapeName);
            shapeSelect.value = '';
            host.onCommit();
        });

        toolbarEl.append(presetSelect, shapeSelect);

        if (hasSelection && selected !== null) {
            const upButton = toolButton('↑', 'Move the selected layer up', () => {
                if (selected !== null && moveLayer(m, selected, -1)) {
                    selected -= 1;
                    host.onCommit();
                }
            });
            upButton.disabled = selected === 0;
            const downButton = toolButton('↓', 'Move the selected layer down', () => {
                if (selected !== null && moveLayer(m, selected, 1)) {
                    selected += 1;
                    host.onCommit();
                }
            });
            downButton.disabled = selected === m.layers.length - 1;
            const deleteButton = toolButton('🗑 Delete', 'Delete the selected layer (Del)', () => {
                deleteSelected();
            });
            deleteButton.disabled = !canRemoveLayer(m);
            toolbarEl.append(divider(), upButton, downButton, deleteButton);

            const layer = m.layers[selected];
            const style = getActiveStyle();

            // Fill-mode select: styles whose layers are not plain colors (hatch patterns,
            // candy gradients) get per-layer options; 'Custom color' reveals the picker.
            const fillSelect = document.createElement('select');
            fillSelect.className = 'tool-select';
            fillSelect.title = 'How this layer is filled';
            const fillOptions: { value: string; label: string }[] = [
                { value: '', label: 'Style default' },
                { value: 'color', label: 'Custom color' },
            ];
            if (style.fills.mode === 'pattern') {
                for (const name of [...new Set(style.fills.patterns.map((p) => p.name))]) {
                    fillOptions.push({ value: `pat:${name}`, label: PATTERN_LABELS[name] });
                }
            }
            // The style's predefined gradients stay as the default cycle per layer
            // position; instead of picking a different preset, the user authors their own
            // stops from the currently shown gradient.
            if ((style.fills.gradients ?? []).length > 0 || layer.gradientColors !== undefined) {
                fillOptions.push({ value: 'grad:custom', label: 'Custom gradient' });
            }
            // An override travels with the layer across styles (a hatched layer stays
            // hatched in Cartoon) — keep it visible and resettable even when the current
            // style's own option list doesn't include it.
            if (
                layer.fillPattern !== undefined &&
                !fillOptions.some((o) => o.value === `pat:${layer.fillPattern}`)
            ) {
                fillOptions.push({
                    value: `pat:${layer.fillPattern}`,
                    label: PATTERN_LABELS[layer.fillPattern],
                });
            }
            for (const option of fillOptions) {
                const element = document.createElement('option');
                element.value = option.value;
                element.textContent = option.label;
                fillSelect.appendChild(element);
            }
            fillSelect.value =
                layer.colorCustom === true
                    ? 'color'
                    : layer.fillPattern !== undefined
                      ? `pat:${layer.fillPattern}`
                      : layer.gradientColors !== undefined
                        ? 'grad:custom'
                        : '';
            const selectedIndex = selected;
            fillSelect.addEventListener('change', () => {
                const value = fillSelect.value;
                delete layer.fillPattern;
                delete layer.gradientColors;
                if (value === '') {
                    delete layer.colorCustom;
                } else if (value === 'color') {
                    layer.colorCustom = true;
                } else if (value.startsWith('pat:')) {
                    layer.fillPattern = value.slice(4) as PatternName;
                    delete layer.colorCustom;
                } else if (value === 'grad:custom') {
                    // Seed the custom gradient with the stops the layer currently shows,
                    // so switching to custom never changes the look — it just unlocks it.
                    const current = effectiveLayerGradient(style, layer, selectedIndex);
                    layer.gradientColors = current
                        ? [...current.stops]
                        : [layer.color, layer.color];
                    delete layer.colorCustom;
                }
                host.onCommit();
            });

            // For hatched layers the picker tints the pattern (keeping the hatch style);
            // for custom-gradient layers one picker per stop edits the gradient itself;
            // for solid layers it sets the layer's own color as before.
            const ink = (isDarkMode() ? style.canvas.dark : style.canvas.light).ink;
            const layerPattern = effectiveLayerPattern(style, layer, selected, ink);
            const tintingPattern = layerPattern !== null && layerPattern.name !== 'none';
            const customStops = layer.gradientColors;
            const customGradient =
                customStops !== undefined &&
                layer.colorCustom !== true &&
                layer.fillPattern === undefined;

            const fillControls: HTMLElement[] = [];
            if (customGradient) {
                const stops = customStops;
                const stopLabels =
                    stops.length === 2
                        ? ['start', 'end']
                        : stops.length === 3
                          ? ['start', 'middle', 'end']
                          : stops.map((_, i) => `color ${i + 1}`);
                stops.forEach((stop, stopIndex) => {
                    const stopInput = document.createElement('input');
                    stopInput.type = 'color';
                    stopInput.className = 'tool-color';
                    stopInput.value = stop;
                    stopInput.title = `Gradient ${stopLabels[stopIndex]}`;
                    stopInput.addEventListener('input', () => {
                        stops[stopIndex] = stopInput.value;
                        // Surgical update of this layer's own gradient def (per-layer ids
                        // make live editing possible without touching other layers).
                        if (svg !== null) {
                            const stopEl = svg.querySelectorAll(`#pyr-grad-${selectedIndex} stop`)[
                                stopIndex
                            ];
                            stopEl?.setAttribute('stop-color', stopInput.value);
                        }
                        host.onLive();
                    });
                    stopInput.addEventListener('change', () => host.onCommit());
                    fillControls.push(stopInput);
                });
            } else {
                const colorInput = document.createElement('input');
                colorInput.type = 'color';
                colorInput.className = 'tool-color';
                colorInput.value = tintingPattern
                    ? (layer.patternColor ?? layerPattern.color)
                    : layer.color;
                colorInput.title = tintingPattern ? 'Pattern color' : 'Layer color';
                colorInput.addEventListener('input', () => {
                    if (tintingPattern) {
                        layer.patternColor = colorInput.value;
                        // Surgical update of this layer's own pattern def — per-layer ids make
                        // live tinting possible without touching other layers.
                        if (svg !== null && selected !== null) {
                            const line = svg.querySelector(`#pyr-pat-${selected} path`);
                            line?.setAttribute('stroke', colorInput.value);
                            const dot = svg.querySelector(`#pyr-pat-${selected} circle`);
                            dot?.setAttribute('fill', colorInput.value);
                        }
                        host.onLive();
                        return;
                    }
                    layer.color = colorInput.value;
                    // A hand-picked color is data now: it beats style defaults AND overrides.
                    layer.colorCustom = true;
                    delete layer.fillPattern;
                    delete layer.gradientColors;
                    fillSelect.value = 'color';
                    // Surgical fill update: rebuilding the toolbar would close the color picker.
                    if (svg !== null && selected !== null) {
                        const poly = svg.querySelector(
                            `path.layer-fill[data-layer-index="${selected}"]`
                        );
                        poly?.setAttribute('fill', colorInput.value);
                    }
                    host.onLive();
                });
                colorInput.addEventListener('change', () => host.onCommit());
                fillControls.push(colorInput);
            }

            const widthField = (edgeIndex: number, labelText: string): HTMLSpanElement => {
                const wrap = document.createElement('span');
                wrap.className = 'width-field';
                const label = document.createElement('label');
                label.textContent = labelText;
                const number = document.createElement('input');
                number.type = 'number';
                number.min = String(MIN_WIDTH);
                number.max = String(MAX_WIDTH);
                number.value = String(m.widths[edgeIndex] ?? 0);
                number.setAttribute('data-width-edge', String(edgeIndex));
                number.title = `Width of ${labelText.toLowerCase()} edge of the selected layer (0–${MAX_WIDTH})`;
                number.addEventListener('input', () => {
                    m.widths[edgeIndex] = clampWidth(Number(number.value));
                    updateGeometryLive();
                    host.onLive();
                });
                number.addEventListener('change', () => {
                    number.value = String(m.widths[edgeIndex]);
                    host.onCommit();
                });
                wrap.append(label, number);
                return wrap;
            };

            toolbarEl.append(
                fillSelect,
                ...fillControls,
                widthField(selected, 'Top'),
                widthField(selected + 1, 'Bottom')
            );
        }
    }

    // --- Selection outline, handles, insert buttons --------------------------
    function renderSelectionUi(): void {
        if (svg === null) return;
        const m = model();
        const style = getActiveStyle();
        if (selected !== null && selected >= m.layers.length) selected = null;
        const group = document.createElementNS(SVG_NS, 'g');
        group.setAttribute('class', 'editing-ui');

        if (selected !== null) {
            const tint = document.createElementNS(SVG_NS, 'polygon');
            tint.setAttribute('class', 'selection-tint');
            tint.setAttribute('points', layerPolygonPoints(m, selected, style));
            tint.setAttribute('opacity', '0.12');
            tint.setAttribute('pointer-events', 'none');
            group.appendChild(tint);

            const inner = document.createElementNS(SVG_NS, 'polygon');
            inner.setAttribute('class', 'selection-inner');
            inner.setAttribute('points', layerPolygonPoints(m, selected, style));
            inner.setAttribute('fill', 'none');
            inner.setAttribute('pointer-events', 'none');
            group.appendChild(inner);

            const outline = document.createElementNS(SVG_NS, 'polygon');
            outline.setAttribute('class', 'selection-outline');
            outline.setAttribute('points', layerPolygonPoints(m, selected, style));
            outline.setAttribute('fill', 'none');
            outline.setAttribute('pointer-events', 'none');
            group.appendChild(outline);
        }

        // Inline "+" insert handles: only on the selected layer's top and bottom edges,
        // centered horizontally — keeps the pyramid clean when nothing is selected.
        if (selected !== null && canAddLayer(m)) {
            for (const edge of [selected, selected + 1]) {
                const geometry = edgeGeometry(m, edge, style);
                const addButton = document.createElementNS(SVG_NS, 'g');
                addButton.setAttribute('class', 'add-layer');
                addButton.setAttribute('data-add-edge', String(edge));
                const addTitle = document.createElementNS(SVG_NS, 'title');
                addTitle.textContent =
                    edge === selected ? 'Add a layer above' : 'Add a layer below';
                addButton.appendChild(addTitle);
                const addCircle = document.createElementNS(SVG_NS, 'circle');
                addCircle.setAttribute('cx', String(geometry.centerX));
                addCircle.setAttribute('cy', String(geometry.y));
                addCircle.setAttribute('r', '10');
                addButton.appendChild(addCircle);
                const plus = document.createElementNS(SVG_NS, 'text');
                plus.setAttribute('x', String(geometry.centerX));
                plus.setAttribute('y', String(geometry.y - 1.5));
                plus.setAttribute('text-anchor', 'middle');
                plus.setAttribute('dominant-baseline', 'central');
                plus.setAttribute('class', 'add-layer-plus');
                plus.textContent = '+';
                addButton.appendChild(plus);
                group.appendChild(addButton);
            }
        }

        if (selected !== null) {
            for (const edge of [selected, selected + 1]) {
                const geometry = edgeGeometry(m, edge, style);
                for (const side of ['left', 'right'] as const) {
                    const handle = document.createElementNS(SVG_NS, 'circle');
                    handle.setAttribute('class', 'width-handle');
                    handle.setAttribute('data-edge', String(edge));
                    handle.setAttribute('data-side', side);
                    handle.setAttribute(
                        'cx',
                        String(side === 'left' ? geometry.leftX : geometry.rightX)
                    );
                    handle.setAttribute('cy', String(geometry.y));
                    handle.setAttribute('r', '7');
                    const handleTitle = document.createElementNS(SVG_NS, 'title');
                    handleTitle.textContent = 'Drag to resize this edge';
                    handle.appendChild(handleTitle);
                    group.appendChild(handle);
                }
                if (widthDrag !== null && widthDrag.edge === edge) {
                    const badge = document.createElementNS(SVG_NS, 'text');
                    badge.setAttribute('x', String(edgeGeometry(m, edge, style).rightX));
                    badge.setAttribute('y', String(edgeGeometry(m, edge, style).y - 12));
                    badge.setAttribute('text-anchor', 'middle');
                    badge.setAttribute('class', 'drag-badge');
                    badge.textContent = String(m.widths[edge]);
                    group.appendChild(badge);
                }
            }
        }

        if (layerDrag !== null && layerDrag.started) {
            const indicatorY = style.layout.padding + layerDrag.insertAt * layerHeightFor(m, style);
            const pyramidWidth = edgeGeometry(m, 0, style).centerX * 2;
            const indicator = document.createElementNS(SVG_NS, 'line');
            indicator.setAttribute('class', 'drop-indicator');
            indicator.setAttribute('x1', '8');
            indicator.setAttribute('x2', String(pyramidWidth - 8));
            indicator.setAttribute('y1', String(indicatorY));
            indicator.setAttribute('y2', String(indicatorY));
            group.appendChild(indicator);
        }

        svg.appendChild(group);
        // Layer labels always paint above everything, including the editing-UI overlays.
        for (const element of svg.querySelectorAll(
            'rect[data-label-chip], [data-edit-field="label"]'
        )) {
            svg.appendChild(element);
        }
        updateHoverOutline();
    }

    function render(): void {
        // A pending inline edit is committed before the DOM it lives in is replaced.
        if (activeInline !== null) {
            activeInline.commit();
            return; // onCommit already triggered a re-render via the host
        }
        canvasEl.textContent = '';
        canvasEl.classList.add('editing');
        svg = renderPyramidSvg(model(), {
            editing: true,
            dark: isDarkMode(),
            style: getActiveStyle(),
        });
        canvasEl.appendChild(svg);
        renderSelectionUi();
        if (layerDrag !== null && layerDrag.started) {
            svg.querySelectorAll(`path[data-layer-index="${layerDrag.from}"]`).forEach((shape) => {
                shape.setAttribute('opacity', '0.45');
            });
        }
        renderToolbar();
    }

    function deleteSelected(): boolean {
        if (selected === null) return false;
        const m = model();
        if (!removeLayer(m, selected)) return false;
        if (selected >= m.layers.length) selected = m.layers.length - 1;
        host.onCommit();
        return true;
    }

    function clearSelection(): void {
        if (selected !== null) {
            selected = null;
            render();
        }
    }

    return {
        render,
        deleteSelected,
        clearSelection,
    };
}
