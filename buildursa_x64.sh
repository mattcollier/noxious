cd node_modules/ursa
npm i -S nan@1.7.0
node-gyp rebuild --target=0.22.1 --arch=x64 --target_platform=linux --dist-url=https://atom.io/download/atom-shell
cd ../..
