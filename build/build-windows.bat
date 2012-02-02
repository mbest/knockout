@echo off 
set OutDebugFile=output\knockout-latest.debug.js
set OutMinFile=output\knockout-latest.js
set AllFiles=
for /f "eol=] skip=1 delims=' " %%i in (fragments\source-references.js) do set Filename=%%i& call :Concatenate 

goto :Combine
:Concatenate 
    if /i "%AllFiles%"=="" ( 
        set AllFiles=..\%Filename:/=\%
    ) else ( 
        set AllFiles=%AllFiles% ..\%Filename:/=\%
    ) 
goto :EOF 

:Combine
echo (function(window,document,navigator,undefined){ > %OutDebugFile%.temp
type fragments\amd-pre.js         >> %OutDebugFile%.temp
type %AllFiles%                   >> %OutDebugFile%.temp
type fragments\amd-post.js        >> %OutDebugFile%.temp
echo })(window,document,navigator); >> %OutDebugFile%.temp

@rem Now call Google Closure Compiler to produce a minified version
tools\curl -d output_info=compiled_code -d output_format=text -d compilation_level=ADVANCED_OPTIMIZATIONS --data-urlencode output_wrapper="(function() {%%output%%})();" --data-urlencode js_code@%OutDebugFile%.temp "http://closure-compiler.appspot.com/compile" > %OutMinFile%.temp

@rem Finalise each file by prefixing with version header and surrounding in function closure
copy /y fragments\version-header.js %OutDebugFile%
type %OutDebugFile%.temp >> %OutDebugFile%
del %OutDebugFile%.temp

copy /y fragments\version-header.js %OutMinFile%
type %OutMinFile%.temp >> %OutMinFile%
del %OutMinFile%.temp

@rem Inject the version number string
set /p Version= <fragments\version.txt
cscript tools\searchReplace.js "##VERSION##" %VERSION% %OutDebugFile% %OutMinFile%