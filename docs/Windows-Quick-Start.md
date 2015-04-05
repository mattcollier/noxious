## Installing Noxious on Windows ##
This guide is a work in progress, and is intended to be a quick start to getting Noxious to work on Windows.

Install git from http://git-scm.com/download/win
During the installation make sure you choose the option *Use Git from the Windows Command Prompt* as this will add git to your path. *note* you'll need to close out of any active command prompts and reopen for this change to take effect.

Install Tor from https://dist.torproject.org/win32/
The current latest available installation package is https://dist.torproject.org/win32/tor-0.2.4.23-win32.exe

Add tor to path. Here's an article on how to accomplish this task:
http://www.howtogeek.com/118594/how-to-edit-your-system-path-for-easy-command-line-access/

Install python 2.x from https://www.python.org/ftp/python/2.7.9/python-2.7.9.amd64.msi

Install Visual Studio from https://www.visualstudio.com/en-us/products/visual-studio-express-vs.aspx
*note* The installer will take quite a bit of time to complete

Install Microsoft Visual C++ 2008 Redistributable Package (x86) from http://www.microsoft.com/en-us/download/details.aspx?id=29

Install Microsoft Visual C++ 2008 Redistributable Package (x64) from http://www.microsoft.com/en-us/download/details.aspx?id=15336

Install OpenSSL 32 and 64 bit versions taking all the default settings:

http://slproweb.com/download/Win32OpenSSL-1_0_1m.exe
http://slproweb.com/download/Win64OpenSSL-1_0_1m.exe


Install Node.js from https://nodejs.org/
Open a command prompt and run "npm install atom-shell -g" and "npm install node-gyp -g"

Now that you have all the dependencies we can install noxious
From a directory of your choice run the following commands:

````
git clone https://github.com/mattcollier/noxious.git
cd noxious
npm install
build_win_ia32
````

Now you should be able to run Noxious :)
````
npm start
````

Install Node.js from https://nodejs.org/
Open a command prompt and run "npm install atom-shell -g" and "npm install node-gyp -g"

Now that you have all the dependencies we can install noxious
From a directory of your choice run the following commands:
git clone https://github.com/mattcollier/noxious.git
cd noxious
npm install
build_win_ia32

Now you should be able to run Noxious :)
npm start
