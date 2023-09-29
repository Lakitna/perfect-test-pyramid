export interface DataFile {
    data: (
        | PyramidData
        | TrophyData
        | InvertedPyramidData
        | RadarData
        | DiamondData
        | CrabData
        | RocketData
        | NullData
    )[];
}

export interface BaseData {
    id: number;
    classification: string | null;
    describes: string;
    observations: string | null;
}

export interface Layer {
    label: string[];
    size: number;
    position: number;
}
export interface Layered {
    layers: Layer[];
}

export interface DescribesTests {
    describes: 'tests';
    includesManual: boolean | string;
}

export interface PyramidData extends BaseData, Layered {
    classification: 'pyramid';
}

export interface TrophyData extends BaseData, Layered {
    classification: 'trophy';
}

export interface InvertedPyramidData extends BaseData, Layered {
    classification: 'inverted-pyramid';
}

export interface RadarData extends BaseData, Layered {
    classification: 'radar';
}

export interface DiamondData extends BaseData, Layered {
    classification: 'diamond';
}

export interface CrabData extends BaseData {
    classification: 'crab';
}

export interface RocketData extends BaseData, Layered {
    classification: 'rocket';
}

export interface NullData extends BaseData {
    classification: null;
}
