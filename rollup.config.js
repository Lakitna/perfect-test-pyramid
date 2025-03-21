import package_ from './package.json' with { type: 'json' };
import typescript from '@rollup/plugin-typescript';
import cleanup from 'rollup-plugin-cleanup';
import del from 'rollup-plugin-delete';
import { externals } from 'rollup-plugin-node-externals';
import copy from 'rollup-plugin-copy'

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
];
