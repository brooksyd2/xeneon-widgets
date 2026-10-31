' Starts the companion with no window. Edit "node" to the full path of node.exe if wscript cannot find it.
Set sh = CreateObject("WScript.Shell")
dir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
sh.Run "node """ & dir & "\index.js""", 0, False
