# TEMPORARY CI probe (PR #9, S1): is a turbo task in a kill-on-close job, and does a Win32_Process.Create child escape it?
param([string]$Mode)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class JobProbe {
  [StructLayout(LayoutKind.Sequential)]
  public struct BASIC {
    public long PerProcessUserTimeLimit;
    public long PerJobUserTimeLimit;
    public uint LimitFlags;
    public UIntPtr MinimumWorkingSetSize;
    public UIntPtr MaximumWorkingSetSize;
    public uint ActiveProcessLimit;
    public UIntPtr Affinity;
    public uint PriorityClass;
    public uint SchedulingClass;
  }
  [DllImport("kernel32.dll")] public static extern IntPtr GetCurrentProcess();
  [DllImport("kernel32.dll", SetLastError = true)] public static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
  [DllImport("kernel32.dll", SetLastError = true)] public static extern bool IsProcessInJob(IntPtr process, IntPtr job, out bool result);
  [DllImport("kernel32.dll", SetLastError = true)] public static extern bool QueryInformationJobObject(IntPtr job, int infoClass, out BASIC info, uint length, IntPtr returnLength);
}
'@

if ($Mode -eq 'self') {
  $inJob = $false
  [JobProbe]::IsProcessInJob([JobProbe]::GetCurrentProcess(), [IntPtr]::Zero, [ref]$inJob) | Out-Null
  $info = New-Object JobProbe+BASIC
  $size = [uint32][Runtime.InteropServices.Marshal]::SizeOf($info)
  $ok = [JobProbe]::QueryInformationJobObject([IntPtr]::Zero, 2, [ref]$info, $size, [IntPtr]::Zero)
  $lastError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
  $flags = $info.LimitFlags
  @{
    inJob = $inJob; queryOk = $ok; lastError = $lastError; limitFlags = $flags
    killOnJobClose = (($flags -band 0x2000) -ne 0)
    breakawayOk = (($flags -band 0x800) -ne 0)
    silentBreakawayOk = (($flags -band 0x1000) -ne 0)
  } | ConvertTo-Json -Compress
}
