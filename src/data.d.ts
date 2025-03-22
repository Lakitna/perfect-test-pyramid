export interface DataFile {
    data: (
        | PyramidData
        | TrophyData
        | InvertedPyramidData
        | SidewaysPyramidData
        | RadarData
        | DiamondData
        | CrabData
        | RocketData
        | HourglassData
        | CupcakeData
        | NullData
    )[];
}

export interface BaseData {
    id: number;
    classification: string | null;
    describes: string;
    observations: string | null;
    notDuplicateWith: BaseData['id'][];
}

export interface Layer {
    label: string[];
    size: number;
    position: number;
}
export interface Layered {
    layers: Layer[];
}

export interface Columned {
    columns: Layer[];
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

export interface SidewaysPyramidData extends BaseData, Columned {
    classification: 'sideways-pyramid';
}

export interface HourglassData extends BaseData, Layered {
    classification: 'hourglass';
}
export interface CupcakeData extends BaseData, Layered {
    classification: 'cupcake';
}
