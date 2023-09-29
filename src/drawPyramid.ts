import { Layer, PyramidData } from './data';

const pyramidWallLeft = '╱';
const pyramidWallRight = '╲';

export function drawPyramid(data: PyramidData) {
    console.log(`describes: ${data.describes}`);
    if (data.id >= 0) {
        console.log(`id: ${data.id}`);
    }
    console.log(drawLayeredPyramid(data.layers));
    if (data.observations !== null) {
        console.log(data.observations);
    }
}

function drawLayeredPyramid(layers: Layer[]): string {
    let internalWidth = 0;
    let lines: string[] = [];

    lines = addLineToPyramid(lines, internalWidth, ' ');
    internalWidth += 2;

    for (const layer of layers) {
        for (let i = 0; i < layer.size; i++) {
            lines = addLineToPyramid(lines, internalWidth, ' ');
            internalWidth += 2;

            if (i === 0) {
                const label = layer.label.join(', ');
                lines = addLineToPyramid(lines, internalWidth, ' ', label);
                internalWidth += 2;
            } else {
                lines = addLineToPyramid(lines, internalWidth, ' ');
                internalWidth += 2;
            }
        }

        lines = addLineToPyramid(lines, internalWidth, '_');
        internalWidth += 2;
    }

    return indentPyramidLines(lines).join('\n');
}

function addLineToPyramid(
    lines: string[],
    bodyWidth: number,
    bodyFiller: string,
    body?: string
): string[] {
    if (body !== undefined) {
        if (body.length > bodyWidth) {
            lines.push(
                pyramidWallLeft + bodyFiller.repeat(bodyWidth) + pyramidWallRight + ' <- ' + body
            );
        } else {
            const paddingLeft = Math.floor((bodyWidth - body.length) / 2);
            const paddingRight = Math.ceil((bodyWidth - body.length) / 2);
            lines.push(
                pyramidWallLeft +
                    bodyFiller.repeat(paddingLeft) +
                    body +
                    bodyFiller.repeat(paddingRight) +
                    pyramidWallRight
            );
        }
    } else {
        lines.push(pyramidWallLeft + bodyFiller.repeat(bodyWidth) + pyramidWallRight);
    }

    return lines;
}

function indentPyramidLines(lines: string[]): string[] {
    return lines.map((line, i) => {
        let indentWidth = lines.length - i;
        return ' '.repeat(indentWidth) + line;
    });
}
