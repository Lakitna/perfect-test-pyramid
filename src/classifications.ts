import { DataFile } from './data';

export function classificationStatistics(data: DataFile) {
    const dataPoints = data.data;

    const descriptors: string[] = [];
    for (const dp of dataPoints) {
        const parts = [dp.classification, dp.describes].map((p) => {
            if (p === undefined) return '[undefined]';
            if (p === null) return '[null]';
            return p;
        });
        descriptors.push(parts.join(' -> '));
    }

    const uniqueDescriptors = [...new Set(descriptors)];
    const descriptorStats = uniqueDescriptors.map((descriptor) => {
        const count = descriptors.filter((d) => d === descriptor).length;
        return {
            descriptor: descriptor,
            count: count,
            percentage: (count / descriptors.length) * 100,
        };
    });

    return descriptorStats.sort((a, b) => b.count - a.count);
}
