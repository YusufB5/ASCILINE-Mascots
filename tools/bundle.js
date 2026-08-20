const fs = require('fs');
const path = require('path');

const bundleOrder = [
    'lib/core/mascot.js',
    'lib/core/sprite.js',
    'lib/physics/pure/helpers/physics_text.js',
    'lib/physics/pure/motion/walking_sprite.js',
    'lib/physics/pure/motion/static_mascot.js',
    'lib/physics/pure/motion/flyer.js',
    'lib/physics/pure/motion/runner_physics.js',
    'lib/physics/pure/motion/jumper_physics.js',
    'lib/physics/pure/motion/swimmer.js',
    'lib/physics/pure/motion/bouncer.js',
    'lib/physics/pure/motion/spider.js',
    'lib/physics/pure/action/bomb_physics.js'
];


function build() {
    console.log('MASCOT Builder - Starting bundle process...');
    const distDir = path.resolve(__dirname, '..', 'dist');
    if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
    }

    const header = '/*!\n * ASCILINE Mascots v1.0.0\n * Spatial Physics and Kinematics for HTML DOM Elements\n * MIT License | https://github.com/YusubB5/ASCILINE-Mascots\n */\n';

    let bundleContent = header + '(function(window, document) {\n\"use strict\";\n\n';

    for (const relPath of bundleOrder) {
        const fullPath = path.resolve(__dirname, '..', relPath);
        if (!fs.existsSync(fullPath)) {
            console.error('Missing source file:', fullPath);
            process.exit(1);
        }
        console.log(' - Bundling:', relPath);
        const fileData = fs.readFileSync(fullPath, 'utf8');
        bundleContent += '// -- ' + relPath + ' --\n' + fileData + '\n\n';
    }

    bundleContent += '})(typeof window !== \"undefined\" ? window : this, typeof document !== \"undefined\" ? document : {});\n';


    const bundlePath = path.join(distDir, 'asciline.bundle.js');
    fs.writeFileSync(bundlePath, bundleContent, 'utf8');
    console.log('[Success] Created:', bundlePath, '(' + (bundleContent.length / 1024).toFixed(1) + ' KB)');

    // Safe minification (trim unnecessary whitespace while preserving code integrity)
    let minContent = header + bundleContent
        .replace(/\/\*[\s\S]*?\*\//g, '') // remove block comments
        .replace(/^\s*\/\/.*$/gm, '')      // remove only full-line comments
        .replace(/^\s+/gm, '')            // trim leading indentation
        .replace(/\n\s*\n/g, '\n');       // collapse consecutive empty lines

    const minPath = path.join(distDir, 'asciline.bundle.min.js');
    fs.writeFileSync(minPath, minContent, 'utf8');
    console.log('[Success] Created:', minPath, '(' + (minContent.length / 1024).toFixed(1) + ' KB)');
}

build();