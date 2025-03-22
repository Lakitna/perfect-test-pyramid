import { max, mean, median, min, quantile, standardDeviation } from 'simple-statistics';
import { DataFile, DescribesTests, DiamondData, PyramidData, TrophyData } from './data';
import { StatsNumericSet } from './stats';

export function testDataStatistics(data: DataFile) {
    const dataPoints = data.data.filter(
        (dp): dp is DataFile['data'][0] & DescribesTests => dp.describes === 'tests'
    );

    const uniqueClassifications = [
        ...new Set(dataPoints.map((dataPoint) => dataPoint.classification)),
    ];
    const classifications = uniqueClassifications.map((classification) => {
        const dps = dataPoints.filter((dp) => dp.classification === classification);

        const count = dps.length;
        const uniqueCount = new Set(
            dps.map((dp) => {
                if (dp.notDuplicateWith.length > 0) {
                    return JSON.stringify(dp.notDuplicateWith);
                }
                return dp.id;
            })
        ).size;
        return {
            classification: classification,
            count: count,
            percentageOfTotal: (count / dataPoints.length) * 100,
            uniqueCount: uniqueCount,
            uniquePercentage: (uniqueCount / count) * 100,
        };
    });

    const uniqueIncludesManual = [...new Set(dataPoints.map((dp) => dp.includesManual))];
    const includesManual = uniqueIncludesManual.map((manual) => {
        const count = dataPoints.filter((dp) => dp.includesManual === manual).length;
        return {
            includesManual: manual,
            count: count,
            percentage: (count / dataPoints.length) * 100,
        };
    });

    return {
        dataPoints: {
            total: data.data.length,
            describesTests: dataPoints.length,
        },
        classifications: classifications.sort((a, b) => b.count - a.count),
        includesManual: includesManual.sort((a, b) => b.count - a.count),
    };
}

export function layerStatistics(data: DataFile) {
    const dataPoints = data.data.filter(
        (dp): dp is (PyramidData | TrophyData | DiamondData) & DescribesTests =>
            (dp.classification === 'pyramid' ||
                dp.classification === 'trophy' ||
                dp.classification === 'diamond') &&
            dp.describes === 'tests'
    );

    // const uniqueClasusifications = [
    //     ...new Set(dataPoints.map((dataPoint) => dataPoint.classification)),
    // ];
    // const classifications = uniqueClasusifications.map((classification) => {
    //     const count = dataPoints.filter((dp) => dp.classification === classification).length;
    //     return {
    //         classification: classification,
    //         count: count,
    //         percentage: (count / dataPoints.length) * 100,
    //     };
    // });

    const layers = dataPoints.map((p) => p.layers);
    const layerCounts = layers.map((l) => l.length);

    const labels = layers
        .flat()
        .map((layer) => layer.label)
        .flat();
    const uniqueLabels = [...new Set(labels)];

    const labelStats = uniqueLabels
        .map((label) => {
            const usedIn = dataPoints.filter((dataPoint) =>
                dataPoint.layers.some((layer) => layer.label.some((l) => l === label))
            );

            const count = usedIn.length;

            const positions = layers
                .map((layers) => {
                    return layers.filter((l) => l.label.includes(label));
                })
                .flat()
                .map((l) => l.position);

            return {
                label: label,
                count: count,
                usedInPercent: (count / layers.length) * 100,
                usedIn: usedIn.map((pyramid) => pyramid.id),
                averagePosition:
                    positions.reduce((prev, cur) => {
                        return prev + cur;
                    }, 0) / positions.length,
            };
        })
        .sort((a, b) => {
            if (a.count > b.count) return -1;
            if (a.count < b.count) return 1;
            return 0;
        });

    return {
        count: toStats(layerCounts),
        labels: labelStats,
    };
}

function toStats(set: number[]): StatsNumericSet {
    return {
        stdev: standardDeviation(set),
        average: mean(set),
        percentiles: {
            min: min(set),
            '1st': quantile(set, 0.01),
            '5th': quantile(set, 0.05),
            median: median(set),
            '95th': quantile(set, 0.95),
            '99th': quantile(set, 0.99),
            max: max(set),
        },
    };
}
