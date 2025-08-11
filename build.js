const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

// Ensure dist directory exists
if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist');
}

// Copy HTML and CSS files
const htmlFiles = ['src/html/index.html', 'src/html/style.css'];
htmlFiles.forEach(file => {
    if (fs.existsSync(file)) {
        fs.copyFileSync(file, path.join('dist', path.basename(file)));
    }
});

// Copy JSTS browser build
const jstsSource = 'node_modules/jsts/dist/jsts.min.js';
const jstsDest = 'dist/jsts.min.js';
if (fs.existsSync(jstsSource)) {
    fs.copyFileSync(jstsSource, jstsDest);
    console.log('Copied JSTS browser build');
} else {
    console.warn('JSTS browser build not found, you may need to download it manually');
}

// Build configuration
const buildConfig = {
    entryPoints: ['src/main.ts'],
    bundle: true,
    outfile: 'dist/bundle.js',
    format: 'iife', // Immediately Invoked Function Expression for browser
    target: 'es2022', // Modern browsers support
    platform: 'browser',
    sourcemap: true,
    minify: false, // Set to true for production
    logLevel: 'info',
    external: ['jsts'], // Mark jsts as external
};

// Check if watch mode
const isWatch = process.argv.includes('--watch');

async function build() {
    try {
        if (isWatch) {
            console.log('Starting watch mode...');
            const ctx = await esbuild.context(buildConfig);
            await ctx.watch();
            console.log('Watching for changes...');
        } else {
            console.log('Building...');
            await esbuild.build(buildConfig);
            console.log('Build complete!');
        }
    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1);
    }
}

build();
