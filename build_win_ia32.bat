cd node_modules\ursa
REM 'call' must be used here because node-gyp calls another batch file
call node-gyp rebuild --target=0.22.3 --arch=ia32 --target_platform=win --dist-url=https://atom.io/download/atom-shell
cd ..\..
