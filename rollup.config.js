import package_ from './package.json' with { type: 'json' };
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import CleanCSS from 'clean-css';
import cleanup from 'rollup-plugin-cleanup';
import del from 'rollup-plugin-delete';
import { externals } from 'rollup-plugin-node-externals';
import copy from 'rollup-plugin-copy'
import { minify as minifyHtml } from 'html-minifier-terser';

/**
 * Minify the static assets that `copy` drops next to the web bundle (HTML + CSS).
 * Runs in writeBundle, after the copied files and the terser'd JS are on disk.
 */
function minifyStaticAssets() {
    return {
        name: 'minify-static-assets',
        async writeBundle(outputOptions) {
            const dir = dirname(outputOptions.file ?? outputOptions.dir);
            const cssPath = resolve(dir, 'styles.css');
            await writeFile(cssPath, new CleanCSS({ level: 1 }).minify(await readFile(cssPath, 'utf8')).styles);
            const htmlPath = resolve(dir, 'index.html');
            await writeFile(
                htmlPath,
                await minifyHtml(await readFile(htmlPath, 'utf8'), {
                    collapseWhitespace: true,
                    conservativeCollapse: true, // keep one space where whitespace is semantic
                    removeComments: true,
                    removeOptionalTags: true,
                })
            );
        },
    };
}

/**
 * @type {import('rollup').RollupOptions[]}
 */
export default [
    {
        input: './src/index.ts',
        output: [{ file: package_.main, format: 'module' }],
        plugins: [
            // Delete contents of target folder
            del({
                targets: package_.files,
            }),

            // Compile source (typescript) to javascript
            typescript({
                tsconfig: './tsconfig.json',
            }),

            // Remove things like comments and whitespace
            cleanup({
                extensions: ['.ts', '.js'],
            }),

            /**
             * Mark all dependencies and node defaults as external to prevent
             * Rollup from including them in the bundle. We'll let the package
             * manager take care of dependency resolution and stuff so we don't
             * have to download the exact same code multiple times, once in
             * this bundle and also as a dependency of another package.
             */
            externals(),
        ],
    },
    {
        // Web frontend: the test pyramid generator (static app in dist/web)
        input: './src/generator/index.ts',
        output: [{ file: 'dist/web/generator.js', format: 'es' }],
        plugins: [
            del({
                targets: 'dist/web/*',
            }),

            typescript({
                tsconfig: './tsconfig.json',
            }),

            cleanup({
                extensions: ['.ts', '.js'],
            }),

            // Ship the web bundle minified (the npm library bundle above stays readable)
            terser({
                format: { comments: false },
            }),

            // Copy the static assets next to the bundle
            copy({
                targets: [
                    { src: 'src/generator/index.html', dest: 'dist/web' },
                    { src: 'src/generator/styles.css', dest: 'dist/web' },
                    // Content-hashed woff2 files: cacheable independently of generator.js
                    { src: 'src/generator/fonts/*.woff2', dest: 'dist/web/fonts' },
                ],
            }),

            // ...then minify the copied HTML + CSS in place
            minifyStaticAssets(),
        ],
    },
];
