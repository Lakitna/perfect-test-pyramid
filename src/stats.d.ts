export interface StatsNumericSet {
    stdev: number;
    average: number;
    percentiles: {
        min: number;
        '1st': number;
        '5th': number;
        median: number;
        '95th': number;
        '99th': number;
        max: number;
    };
}
