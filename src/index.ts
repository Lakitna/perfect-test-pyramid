import path from 'node:path';
import { classificationStatistics } from './classifications';
import { PyramidData } from './data';
import { detectDuplicateFiles, detectDuplicateModels } from './detectDuplicates';
import { drawPyramid } from './drawPyramid';
import { layerStatistics, testDataStatistics } from './layers';
import { mostAveragePyramid } from './mostAveragePyramid';
import { readData } from './parse-data';

const dataFolder = path.resolve('data');

console.log('Searching for duplicate source image files...');
const duplicateFiles = await detectDuplicateFiles(path.join(dataFolder, 'source'));
if (duplicateFiles.length > 0) {
    console.log('Found exact duplicate source files. Aborting.');
    console.log(duplicateFiles);
    process.exit(1);
}

const dataFile = path.join(dataFolder, 'pyramids.yaml');
const data = await readData(dataFile);

console.log('Searching for duplicate data...');
const duplicateModels = detectDuplicateModels(data);
if (Object.keys(duplicateModels).length > 0) {
    console.log('Found unaccounted for duplicate model data:');
    console.log(duplicateModels);
    process.exit(1);
}

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
            label: ['part of application'],
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
    notDuplicateWith: [],
};
drawPyramid(personalPyramid);
