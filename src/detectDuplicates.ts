import { createHash } from 'node:crypto';
import { open, opendir } from 'node:fs/promises';
import path from 'node:path';
import { BaseData, DataFile } from './data';

export async function detectDuplicateFiles(folderPath: string): Promise<string[][]> {
    const fileHashes: { name: string; hash: string }[] = [];

    for await (const file of dirReader(folderPath)) {
        const hash = createHash('sha256');

        const fileHandle = await open(path.join(folderPath, file.name), 'r');
        hash.update((await fileHandle.read()).buffer);
        fileHandle.close();

        const f = {
            name: file.name,
            hash: hash.digest('base64'),
        };
        fileHashes.push(f);
    }

    const hashes = fileHashes.map((file) => file.hash);
    const hashCount: { [key: string]: number } = {};
    for (const hash of hashes) {
        if (!hashCount[hash]) {
            hashCount[hash] = 0;
        }
        hashCount[hash] = hashCount[hash] + 1;
    }

    return Object.entries(hashCount)
        .filter(([_, count]) => count > 1)
        .map(([hash, _]) => {
            return fileHashes.filter((file) => file.hash == hash).map((file) => file.name);
        });
}

async function* dirReader(folderPath: string) {
    const dir = await opendir(folderPath);

    while (true) {
        const file = await dir.read();
        if (file == null) {
            break;
        }
        yield file;
    }
}

export function detectDuplicateModels(data: DataFile) {
    const dataPoints = data.data;

    const dataPointsByClassification: {
        [key: string]: DataFile['data'];
    } = {};
    for (const dataPoint of dataPoints) {
        if (dataPoint.classification == null) continue;

        if (!dataPointsByClassification[dataPoint.classification]) {
            dataPointsByClassification[dataPoint.classification] = [];
        }
        dataPointsByClassification[dataPoint.classification].push(dataPoint);
    }

    const duplicatesByClassification: {
        [key: string]: number[][];
    } = {};
    for (const [classification, dataPoints] of Object.entries(dataPointsByClassification)) {
        const duplicates = findDuplicates(dataPoints);
        if (duplicates.length === 0) {
            continue;
        }
        duplicatesByClassification[classification] = duplicates;
    }

    return duplicatesByClassification;
}

function findDuplicates(dataPoints: DataFile['data']) {
    if (dataPoints.length <= 2) {
        return [];
    }

    const duplicates: BaseData['id'][][] = [];
    for (const dp of dataPoints) {
        const alreadyFound = duplicates.some((duplicateGroup) => {
            return duplicateGroup.some((id) => id === dp.id);
        });
        if (alreadyFound) {
            continue;
        }

        const dpDuplicates = dataPoints.filter((cdp) => {
            if (dp.id === cdp.id) return false;

            if (dp.notDuplicateWith.includes(cdp.id)) return false;

            if (dp.describes !== cdp.describes) return false;

            if (!layersAreDuplicate(dp, cdp)) {
                return false;
            }

            return true;
        });

        if (dpDuplicates.length === 0) continue;
        duplicates.push([dp.id, ...dpDuplicates.map((dp) => dp.id)]);
    }

    return duplicates;
}

function layersAreDuplicate<T extends DataFile['data'][0]>(a: T, b: T): boolean {
    let layersA;
    let layersB;
    if ('layers' in a && 'layers' in b) {
        layersA = a.layers;
        layersB = b.layers;
    } else if ('columns' in a && 'columns' in b) {
        layersA = a.columns;
        layersB = b.columns;
    } else {
        return false;
    }

    if (layersA.length != layersB.length) return false;

    const duplicateLayers = layersA.filter((dpl, i) => {
        const cdpl = layersB[i];
        if (dpl.position !== cdpl.position) return false;

        if (
            dpl.label.sort().toString().toLowerCase() !== cdpl.label.sort().toString().toLowerCase()
        )
            return false;

        return true;
    });
    if (duplicateLayers.length !== layersA.length) return false;

    return true;
}
