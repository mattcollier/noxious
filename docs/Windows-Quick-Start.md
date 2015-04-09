## Installing Noxious on Windows ##
This guide is a work in progress, and is intended to be a quick start to getting Noxious to work on Windows.

#### Install git from http://git-scm.com/download/win
- During the installation make sure you choose the option *Use Git from the Windows Command Prompt* as this will add git to your path. *note* you'll need to close out of any active command prompts and reopen for this change to take effect.

#### Install Tor from https://dist.torproject.org/win32/
- The current latest available installation package is https://dist.torproject.org/win32/tor-0.2.4.23-win32.exe

#### Add tor to path
- http://www.howtogeek.com/118594/how-to-edit-your-system-path-for-easy-command-line-access/

#### Install the latest python 2.x from https://www.python.org/downloads/windows/
-  python-2.7.9.amd64.msi has been tested

#### Install Visual Studio Express
For Windows 8.1 and above you'll need to install Visual Studio Express 2013 for Windows
For Windows 8.0 and below you'll need to install Visual Studio Express 2013 for Windows Desktop
- https://www.visualstudio.com/en-us/products/visual-studio-express-vs.aspx
*note* The installer will take quite a bit of time to complete and requires signup

#### Install Microsoft Visual C++ 2008 Redistributable Package (x86)
- http://www.microsoft.com/en-us/download/details.aspx?id=29

#### Install Microsoft Visual C++ 2008 Redistributable Package (x64)
- http://www.microsoft.com/en-us/download/details.aspx?id=15336

#### Install OpenSSL
The non light installers are needed.
- http://slproweb.com/products/Win32OpenSSL.html
*note Both the 32 and 64 bit will need to be installed.*


#### Install Node.js and dependencies
- https://nodejs.org/
- Open a command prompt and run the following commands
````
npm install atom-shell -g
npm install node-gyp -g
````
#### Install Noxious
Now that you have all the dependencies we can install noxious
From a directory of your choice run the following commands:

````
git clone https://github.com/mattcollier/noxious.git
cd noxious
npm install
build_win_ia32
````
#### Starting Noxious
Now you should be able to run Noxious :)
````
npm start
````
