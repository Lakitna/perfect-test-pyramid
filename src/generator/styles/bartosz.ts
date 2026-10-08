import type { PyramidStyle } from './types';

const MONTSERRAT = "'Montserrat'";
const STACK = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/**
 * Bartosz: the corporate look of bartosz.nl — brand purple (#5A2CBC) used as INK on
 * white paper (their blog literally sets body text in purple). Their marketing
 * diagrams run on shades of purple alone, so both modes do too: every layer fill is
 * a purple (night → brand → lilac), chips are white pills outlined in purple, and
 * the brand's mint (#92E8E3) survives only as an accent — a pale mint wash behind
 * the light-mode app chrome and the attribution hint in dark mode. Montserrat type
 * (ARS Maquette's open-source cousin). Flat color blocks, no jitter, no decoration:
 * precision-tested software, grensverleggend. Every fill reaches ≥ 3:1 against its
 * ground; chips hit ≥ 7:1.
 */
export const bartoszStyle: PyramidStyle = {
    id: 'bartosz',
    name: 'Bartosz',
    typography: {
        fallback: STACK,
        roles: {
            title: { family: MONTSERRAT, weight: 700, size: 22 },
            label: { family: MONTSERRAT, weight: 600, size: 15 },
            notes: { family: MONTSERRAT, weight: 400, size: 13, lineHeight: 18 },
            descriptor: { family: MONTSERRAT, weight: 400, size: 13, lineHeight: 18 },
            attribution: { family: MONTSERRAT, weight: 400, size: 10 },
        },
        fonts: [
            ['Montserrat', 400],
            ['Montserrat', 600],
            ['Montserrat', 700],
        ],
    },
    canvas: {
        light: {
            // White paper + purple ink; the pills are the site's outline style: white
            // ground, purple border, purple text. No other hues — the brand has none.
            background: '#ffffff',
            separator: '#ffffff',
            notes: '#5a2cbc',
            hint: '#5a2cbc',
            chip: '#ffffff',
            chipStroke: '#5a2cbc',
            chipText: '#5a2cbc',
            title: '#5a2cbc',
            ink: '#5a2cbc',
        },
        dark: {
            background: '#150c2e',
            separator: '#150c2e',
            notes: '#e6dcfa',
            // The mint accent: brand mint reads 12:1 on night purple.
            hint: '#92e8e3',
            // Same pill language as light: white fill, purple outline, purple text.
            chip: '#ffffff',
            chipStroke: '#9f7bea',
            chipText: '#3b1e78',
            title: '#ffffff',
            ink: '#9f7bea',
        },
    },
    fills: {
        mode: 'solid',
        patterns: [{ name: 'none' }],
        patternSpacing: 6,
        patternStroke: 1,
        patternOpacity: 1,
    },
    // Flat blocks separated by ground-colored gaps — the site's clean color-band look.
    stroke: { layerOutline: 0, separatorWidth: 4 },
    jitter: { amplitude: 0, segmentLength: 24, salt: 21 },
    label: {
        // The site's buttons: fully rounded pills, white with a purple outline.
        mode: 'chip',
        rx: 16,
        padX: 14,
        height: 32,
        borderWidth: 2,
        shadowOffset: 0,
        haloWidth: 0,
    },
    frame: 'none',
    legendRule: false,
    legendLeaders: null,
    layers: {
        colorSource: 'palette',
        palette: {
            // Shades of purple only — like their marketing diagrams. All ≥ 3:1 on white.
            light: ['#5a2cbc', '#24124d', '#7a4fd0', '#3b1e78', '#9b6fe0', '#4a148c'],
            // Shades of purple only. All ≥ 3:1 against the night-purple ground.
            dark: ['#9f7bea', '#c9b3f5', '#7a52cc', '#b79cf0', '#e2d7fa', '#8a63e0'],
        },
    },
    layout: {
        baseUnit: 6,
        padding: 12,
        titleSpace: 60,
        descriptorSpace: 20,
        targetAspect: 1.4,
        heightAnchor: 430,
        minLayerHeight: 50,
        maxLayerHeight: 300,
        legendWidth: 400,
        legendGap: 24,
    },
    chrome: {
        light: {
            // Purple ink on white; the mint accent lives here as a pale wash behind
            // the app chrome (the site's own header-band mint, muted).
            '--background': '#eef6f5',
            '--surface': '#ffffff',
            '--border': '#cdeae5',
            '--text': '#5a2cbc',
            '--text-muted': '#6f5aa8',
            '--accent': '#5a2cbc',
            '--danger': '#d81b60',
            '--hover': '#e0f2ef',
            '--font-ui': `${MONTSERRAT}, ${STACK}`,
        },
        dark: {
            '--background': '#120a26',
            '--surface': '#1b1038',
            '--border': '#43336e',
            '--text': '#efeafb',
            '--text-muted': '#b4a8d6',
            '--accent': '#9f7bea',
            // The accent is a light lilac — white-on-lilac would fall short, so ink it dark.
            '--accent-ink': '#1b0e3f',
            '--danger': '#ff8080',
            '--hover': '#241645',
            '--font-ui': `${MONTSERRAT}, ${STACK}`,
        },
    },
};
