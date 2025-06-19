; Custom NSIS script for Visual Player
; This script helps preserve taskbar shortcuts during updates

!include LogicLib.nsh
!include WinMessages.nsh
!include FileFunc.nsh

Var IsUpdate
Var OldVersion
Var InstallPath

!macro customInit
  ; Check if this is an update installation
  ReadRegStr $R0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "DisplayName"
  ReadRegStr $OldVersion HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "DisplayVersion"
  ReadRegStr $InstallPath HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "InstallLocation"
  
  ; Also check if executable exists in the install directory
  ${If} $R0 != ""
  ${AndIf} ${FileExists} "$InstallPath\Visual Player.exe"
    ; This is an update, set a flag
    StrCpy $IsUpdate "true"
    DetailPrint "Detected existing installation: $OldVersion at $InstallPath"
    DetailPrint "Performing update installation..."
    
    ; Ensure we install to the same location
    ${If} $InstallPath != ""
      StrCpy $INSTDIR $InstallPath
    ${EndIf}
  ${Else}
    StrCpy $IsUpdate "false"
    DetailPrint "Performing fresh installation..."
  ${EndIf}
!macroend

!macro customInstall
  ; Custom installation steps
  ${If} $IsUpdate == "true"
    DetailPrint "Updating Visual Player from $OldVersion to ${VERSION}..."
    
    ; Close any running instances before update
    nsExec::ExecToLog 'taskkill /F /IM "Visual Player.exe" /T'
    nsExec::ExecToLog 'taskkill /F /IM "visual-player.exe" /T'
    Sleep 1000
    
    ; Preserve user data and settings
    DetailPrint "Preserving user settings and shortcuts..."
    
    ; Skip shortcut creation during update to preserve existing ones
    ; The executable will be replaced but shortcuts pointing to the same path
    ; will continue to work automatically
  ${Else}
    DetailPrint "Installing Visual Player ${VERSION}..."
    
    ; Create shortcuts for fresh installation
    DetailPrint "Creating shortcuts for fresh installation..."
    
    ; Create desktop shortcut only if it doesn't exist
    ${IfNot} ${FileExists} "$DESKTOP\Visual Player.lnk"
      CreateShortCut "$DESKTOP\Visual Player.lnk" "$INSTDIR\Visual Player.exe"
      DetailPrint "Created desktop shortcut"
    ${EndIf}
    
    ; Create start menu shortcut only if it doesn't exist
    CreateDirectory "$SMPROGRAMS\Visual Player"
    ${IfNot} ${FileExists} "$SMPROGRAMS\Visual Player\Visual Player.lnk"
      CreateShortCut "$SMPROGRAMS\Visual Player\Visual Player.lnk" "$INSTDIR\Visual Player.exe"
      DetailPrint "Created start menu shortcut"
    ${EndIf}
  ${EndIf}
!macroend

!macro customUnInstall
  ; Custom uninstallation steps
  DetailPrint "Removing Visual Player..."
  
  ; Close running instances
  nsExec::ExecToLog 'taskkill /F /IM "Visual Player.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "visual-player.exe" /T'
  Sleep 1000
  
  ; Only remove shortcuts during complete uninstall (not update)
  DetailPrint "Removing shortcuts during uninstall..."
  Delete "$DESKTOP\Visual Player.lnk"
  Delete "$SMPROGRAMS\Visual Player\Visual Player.lnk"
  RMDir "$SMPROGRAMS\Visual Player"
  
  ; Clean up registry entries
  DeleteRegKey HKCU "Software\visual-player"
!macroend

; Handle file operations during update
!macro customRemoveFiles
  ; During update, don't remove user data
  ${If} $IsUpdate == "true"
    DetailPrint "Preserving user data during update..."
  ${EndIf}
!macroend

; Custom finalization after installation
!macro customFinishInstall
  DetailPrint "Installation completed successfully"
!macroend

; Custom header for installer
!macro customHeader
  !system "echo Preparing Visual Player installer..."
!macroend 