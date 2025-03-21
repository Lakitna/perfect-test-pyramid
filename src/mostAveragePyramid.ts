import { Layer, PyramidData } from './data';
import { layerStatistics } from './layers';

export function mostAveragePyramid(
    layerCount: number,
    layerStats: ReturnType<typeof layerStatistics>
): PyramidData {
    const mostAveragePyramid: PyramidData = {
        classification: 'pyramid',
        describes: 'tests',
        layers: new Array(layerCount).fill(undefined).map((_, i) => {
            const position = i / (layerCount - 1);
            return findLayerLabel(position, layerStats);
        }),
        id: -layerCount,
        observations: 'Most average with ' + layerCount + ' layers',
        notDuplicateWith: [],
    };

    return mergeDuplicateLayers(mostAveragePyramid);
}

/**
 * Find a layers label based on the layer statistics. This results in the most average label for
 * the layer at the given position.
 */
function findLayerLabel(
    layerPosition: number,
    layerStats: ReturnType<typeof layerStatistics>
): Layer {
    let foundLayer: (typeof layerStats.labels)[0] | undefined;
    for (let acceptableDistance = 0.1; acceptableDistance < 0.5; acceptableDistance += 0.05) {
        for (
            let requiredUsedInPercent = 50;
            requiredUsedInPercent >= 10;
            requiredUsedInPercent -= 5
        ) {
            foundLayer = layerStats.labels.find((layer) => {
                if (layer.usedInPercent < requiredUsedInPercent) return false;

                const distance = layer.averagePosition - layerPosition;
                return -acceptableDistance < distance && distance < acceptableDistance;
            });
            if (foundLayer !== undefined) break;
        }
        if (foundLayer !== undefined) break;
    }
    if (foundLayer === undefined) {
        throw new Error('Could not find a layer for position ' + layerPosition);
    }

    const layer: Layer = {
        label: [foundLayer.label],
        size: 1,
        position: layerPosition,
    };
    return layer;
}

function mergeDuplicateLayers(pyramid: PyramidData): PyramidData {
    const merged = Object.assign({}, pyramid) as PyramidData;
    const uniqueLabels = new Set(merged.layers.map((l) => l.label[0]));

    merged.layers = new Array(uniqueLabels.size).fill(undefined).map((_, i) => {
        const label = [...uniqueLabels][i];
        const layers = pyramid.layers.filter((l) => l.label[0] === label);
        const position = i / (uniqueLabels.size - 1);
        return {
            label: [label],
            size: layers.length,
            position: position,
        };
    });
    return merged;
}
