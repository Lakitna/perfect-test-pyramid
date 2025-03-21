import yaml from 'js-yaml';
import { readFile } from 'node:fs/promises';
import {
    BaseData,
    CrabData,
    DataFile,
    DescribesTests,
    DiamondData,
    InvertedPyramidData,
    Layer,
    NullData,
    PyramidData,
    RadarData,
    RocketData,
    SidewaysPyramidData,
    TrophyData,
} from './data';

export async function readData(filePath: string): Promise<DataFile> {
    const raw = yaml.load(await readFile(filePath, { encoding: 'utf-8' })) as Record<
        string,
        unknown
    >;
    if (!raw.data || !Array.isArray(raw.data)) {
        throw new Error('Datafile has no data property', { cause: raw });
    }

    const data = raw.data.map((dataPoint) => {
        switch (dataPoint.classification) {
            case 'pyramid':
                if (dataPoint.describes === 'tests') {
                    return toTestPyramidData(dataPoint);
                }
                return toPyramidData(dataPoint);
            case 'trophy':
                if (dataPoint.describes === 'tests') {
                    return toTestTrophyData(dataPoint);
                }
                return toTrophyData(dataPoint);
            case 'diamond':
                if (dataPoint.describes === 'tests') {
                    return toTestDiamondData(dataPoint) as DiamondData & DescribesTests;
                }
                return toBaseData(dataPoint) as DiamondData;
            case 'inverted-pyramid':
                if (dataPoint.describes === 'tests') {
                    return toTestBaseData(dataPoint) as InvertedPyramidData & DescribesTests;
                }
                return toBaseData(dataPoint) as InvertedPyramidData;
            case 'sideways-pyramid':
                if (dataPoint.describes === 'tests') {
                    return toTestBaseData(dataPoint) as SidewaysPyramidData & DescribesTests;
                }
                return toBaseData(dataPoint) as SidewaysPyramidData;
            case 'radar':
                if (dataPoint.describes === 'tests') {
                    return toTestBaseData(dataPoint) as RadarData & DescribesTests;
                }
                return toBaseData(dataPoint) as RadarData;
            case 'crab':
                if (dataPoint.describes === 'tests') {
                    return toTestBaseData(dataPoint) as CrabData & DescribesTests;
                }
                return toBaseData(dataPoint) as CrabData;
            case 'rocket':
                if (dataPoint.describes === 'tests') {
                    return toTestBaseData(dataPoint) as RocketData & DescribesTests;
                }
                return toBaseData(dataPoint) as RocketData;
            case null:
                if (dataPoint.describes === 'tests') {
                    return toTestBaseData(dataPoint) as NullData & DescribesTests;
                }
                return toBaseData(dataPoint) as NullData;
            default:
                throw new Error('Unexpected data classification ' + dataPoint.classification);
        }
    });

    return { data };
}

function toBaseData(raw: Record<string, unknown>): BaseData {
    if (raw.id === undefined || typeof raw.id !== 'number') {
        throw new Error('Data has no id', { cause: raw });
    }

    if (
        raw.classification === undefined ||
        (typeof raw.classification !== 'string' && raw.classification !== null)
    ) {
        throw new Error('Data has no classification', { cause: raw });
    }

    if (raw.describes === undefined || typeof raw.describes !== 'string') {
        throw new Error('Data has no describes', { cause: raw });
    }

    if (
        raw.observations === undefined ||
        (typeof raw.observations !== 'string' && raw.observations !== null)
    ) {
        throw new Error('Data has no observations', { cause: raw });
    }

    if (raw.notDuplicateWith === undefined) {
        raw.notDuplicateWith = [];
    }
    let dupeWith = Array.isArray(raw.notDuplicateWith)
        ? raw.notDuplicateWith
        : [raw.notDuplicateWith];
    dupeWith.forEach((duplicate) => {
        if (duplicate === undefined || typeof duplicate !== 'number') {
            throw new Error(`Duplicate ${duplicate} is not an ID`, { cause: raw });
        }
    });

    return {
        id: raw.id,
        classification: raw.classification,
        describes: raw.describes,
        observations: raw.observations,
        notDuplicateWith: dupeWith,
    };
}

function toTestBaseData(
    raw: Record<string, unknown> & { describes: 'tests' }
): BaseData & DescribesTests {
    const base = toBaseData(raw);
    const test = toDescribesTest(raw);

    return {
        ...base,
        ...test,
    };
}

function toLayer(
    raw: Record<string, unknown>,
    index: number,
    rawLayers: Record<string, unknown>[]
): Layer {
    if (
        raw.label === undefined ||
        (raw.label !== null && typeof raw.label !== 'string' && !Array.isArray(raw.label))
    ) {
        throw new Error('Has no label', { cause: raw });
    }
    if (raw.label === null) {
        raw.label = '[empty]';
    }

    if (raw.size === undefined || typeof raw.size !== 'number') {
        throw new Error('Has no size', { cause: raw });
    }
    if (raw.size < 0) {
        throw new Error('Size is negative', { cause: raw });
    }

    return {
        label: Array.isArray(raw.label) ? raw.label : [raw.label],
        size: raw.size,
        position: index / (rawLayers.length - 1),
    };
}

function toDescribesTest(raw: Record<string, unknown> & { describes: 'tests' }): DescribesTests {
    const base = toBaseData(raw);

    if (base.describes !== 'tests') {
        throw new Error('Describes not tests', { cause: raw });
    }

    if (
        raw.includesManual === undefined ||
        (typeof raw.includesManual !== 'string' && typeof raw.includesManual !== 'boolean')
    ) {
        throw new Error('Has no includesManual', { cause: raw });
    }

    return {
        describes: base.describes,
        includesManual: raw.includesManual,
    };
}

function toPyramidData(raw: Record<string, unknown> & { classification: 'pyramid' }): PyramidData {
    const base = toBaseData(raw);

    if (base.classification !== 'pyramid') {
        throw new Error('classification not pyramid', { cause: raw });
    }

    if (raw.layers === undefined || !Array.isArray(raw.layers)) {
        throw new Error('Has no layers', { cause: raw });
    }

    return {
        id: base.id,
        classification: base.classification,
        describes: base.describes,
        observations: base.observations,
        notDuplicateWith: base.notDuplicateWith,
        layers: raw.layers.map(toLayer),
    };
}

function toTestPyramidData(
    raw: Record<string, unknown> & { classification: 'pyramid' } & { describes: 'tests' }
): PyramidData & DescribesTests {
    const pyramid = toPyramidData(raw);
    const test = toDescribesTest(raw);

    return {
        ...pyramid,
        ...test,
    };
}

function toTrophyData(raw: Record<string, unknown> & { classification: 'trophy' }): TrophyData {
    const base = toBaseData(raw);

    if (base.classification !== 'trophy') {
        throw new Error('classification not trophy', { cause: raw });
    }

    if (raw.layers === undefined || !Array.isArray(raw.layers)) {
        throw new Error('Has no layers', { cause: raw });
    }

    return {
        id: base.id,
        classification: base.classification,
        describes: base.describes,
        observations: base.observations,
        notDuplicateWith: base.notDuplicateWith,
        layers: raw.layers.map(toLayer),
    };
}

function toTestTrophyData(
    raw: Record<string, unknown> & { classification: 'trophy' } & { describes: 'tests' }
): TrophyData & DescribesTests {
    const trophy = toTrophyData(raw);
    const test = toDescribesTest(raw);

    return {
        ...trophy,
        ...test,
    };
}

function toDiamondData(raw: Record<string, unknown> & { classification: 'diamond' }): DiamondData {
    const base = toBaseData(raw);

    if (base.classification !== 'diamond') {
        throw new Error('classification not diamond', { cause: raw });
    }

    if (raw.layers === undefined || !Array.isArray(raw.layers)) {
        throw new Error('Has no layers', { cause: raw });
    }

    return {
        id: base.id,
        classification: base.classification,
        describes: base.describes,
        observations: base.observations,
        notDuplicateWith: base.notDuplicateWith,
        layers: raw.layers.map(toLayer),
    };
}

function toTestDiamondData(
    raw: Record<string, unknown> & { classification: 'diamond' } & { describes: 'tests' }
): DiamondData & DescribesTests {
    const diamond = toDiamondData(raw);
    const test = toDescribesTest(raw);

    return {
        ...diamond,
        ...test,
    };
}
