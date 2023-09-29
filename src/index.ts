import { classificationStatistics } from './classifications';
import { PyramidData } from './data';
import { drawPyramid } from './drawPyramid';
import { layerStatistics, testDataStatistics } from './layers';
import { mostAveragePyramid } from './mostAveragePyramid';
import { readData } from './parse-data';

const dataFile = 'data/pyramids.yaml';
const data = await readData(dataFile);

const classifications = classificationStatistics(data);
console.log(classifications);
const testDataStats = testDataStatistics(data);
console.log(testDataStats);
const layerStats = layerStatistics(data);
console.log(layerStats);

// data.data
//     .filter((d): d is PyramidData => {
//         return d.classification === 'pyramid' && d.describes === 'tests';
//     })
//     .forEach((pyramid) => {
//         drawPyramid(pyramid);
//         console.log();
//         console.log();
//     });

// process.exit(0);

// console.log('-'.repeat(50));

for (let layerCount = 2; layerCount <= 20; layerCount++) {
    const pyramid = mostAveragePyramid(layerCount, layerStats);
    drawPyramid(pyramid);
    console.log();
    console.log();
}

console.log('-'.repeat(50));

const personalPyramid: PyramidData = {
    classification: 'pyramid',
    describes: 'tests',
    layers: [
        {
            label: ['multi-application'],
            size: 1,
            position: 0,
        },
        {
            label: ['application'],
            size: 1,
            position: 0,
        },
        {
            label: ['component'],
            size: 1,
            position: 0,
        },
        {
            label: ['unit'],
            size: 1,
            position: 0,
        },
        {
            label: ['static'],
            size: 1,
            position: 0,
        },
    ],
    id: -999,
    observations: 'My personal pyramid',
};
// drawPyramid(personalPyramid);
