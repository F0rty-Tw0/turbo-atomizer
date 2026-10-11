' TEMPORARY CI probe (PR #9, S1): Win32_Process.Create through WSH, no powershell. Stdin: command line, cwd, then
' NAME=value env entries, one per line. Prints { returnValue, processId }.
Dim text, parts, envs(), i, wmi, startup, rc, pid
text = WScript.StdIn.ReadAll
parts = Split(text, vbLf)
ReDim envs(UBound(parts) - 2)
For i = 2 To UBound(parts)
  envs(i - 2) = parts(i)
Next
Set wmi = GetObject("winmgmts:{impersonationLevel=impersonate}!\\.\root\cimv2")
Set startup = wmi.Get("Win32_ProcessStartup").SpawnInstance_
startup.ShowWindow = 0
startup.EnvironmentVariables = envs
rc = wmi.Get("Win32_Process").Create(parts(0), parts(1), startup, pid)
WScript.StdOut.Write "{""returnValue"":" & rc & ",""processId"":" & pid & "}"
