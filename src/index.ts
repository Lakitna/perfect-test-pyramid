import path from 'node:path';
import { classificationStatistics } from './classifications';
import { detectDuplicateFiles } from './detectDuplicates';
import { drawPyramid } from './drawPyramid';
import { layerStatistics, testDataStatistics } from './layers';
import { mostAveragePyramid } from './mostAveragePyramid';
import { readData } from './parse-data';

const dataFolder = path.resolve('data');

const duplicateFiles = await detectDuplicateFiles(path.join(dataFolder, 'source'));
if (duplicateFiles.length > 0) {
    console.log('Found exact duplicate source files. Aborting.');
    console.log(duplicateFiles);
    process.exit(1);
}

const dataFile = path.join(dataFolder, 'pyramids.yaml');
const data = await readData(dataFile);
// TODO: detect duplicate data. Crash without signoff in data file.

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

// console.log('-'.repeat(50));

console.log();
const pyramid = mostAveragePyramid(Math.round(layerStats.count.average), layerStats);
drawPyramid(pyramid);

// for (let layerCount = 2; layerCount <= 20; layerCount++) {
//     const pyramid = mostAveragePyramid(layerCount, layerStats);
//     drawPyramid(pyramid);
//     console.log();
//     console.log();
// }

// console.log('-'.repeat(50));

// const personalPyramid: PyramidData = {
//     classification: 'pyramid',
//     describes: 'tests',
//     layers: [
//         {
//             label: ['Sannia'],
//             size: 1,
//             position: 0,
//         },
//         {
//             label: ['application'],
//             size: 1,
//             position: 0,
//         },
//         {
//             label: ['part of application'],
//             size: 1,
//             position: 0,
//         },
//         {
//             label: ['unit'],
//             size: 1,
//             position: 0,
//         },
//         {
//             label: ['static'],
//             size: 1,
//             position: 0,
//         },
//     ],
//     id: -999,
//     observations: 'My personal pyramid',
//     notDuplicateWith: [],
// };
// drawPyramid(personalPyramid);
