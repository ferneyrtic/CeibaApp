<#
.SYNOPSIS
    Script en PowerShell para recordatorio sonoro cada 5 min con conteo de tiempo transcurrido tras la alarma.
#>
param (
    [int]$Minutos = 5
)

$segundosTotales = $Minutos * 60
$contador = 0

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "🔔 RECORDATORIO ACTIVO EN POWERSHELL" -ForegroundColor Green
Write-Host "⏰ Intervalo configurado: $Minutos minutos" -ForegroundColor Yellow
Write-Host "👉 Presiona Ctrl + C para detener en cualquier momento" -ForegroundColor Gray
Write-Host "=================================================" -ForegroundColor Cyan

function Emitir-Sonido {
    [Console]::Beep(523, 120)
    Start-Sleep -Milliseconds 20
    [Console]::Beep(659, 120)
    Start-Sleep -Milliseconds 20
    [Console]::Beep(784, 140)
    Start-Sleep -Milliseconds 20
    [Console]::Beep(1046, 250)
}

while ($true) {
    # 1. Cuenta regresiva
    for ($s = $segundosTotales; $s -gt 0; $s--) {
        $m = [math]::Floor($s / 60)
        $sec = $s % 60
        $tiempoStr = "{0:D2}:{1:D2}" -f $m, $sec
        Write-Host -NoNewline "`r⏳ [CUENTA REGRESIVA]: $tiempoStr | Ciclos sonados: $contador   "
        Start-Sleep -Seconds 1
    }

    # 2. Alarma sonora
    $contador++
    $hora = (Get-Date).ToString("HH:mm:ss")
    Write-Host "`n`n🔔 [¡ALARMA #$contador A LAS $hora!] 🔔" -ForegroundColor Magenta
    Emitir-Sonido
    Write-Host "👉 Presiona [ENTER] para reactivar el ciclo de $Minutos minutos." -ForegroundColor Yellow

    # 3. Conteo hacia adelante de tiempo transcurrido
    $tiempoPasado = 0
    while (-not [Console]::KeyAvailable) {
        $mPasado = [math]::Floor($tiempoPasado / 60)
        $sPasado = $tiempoPasado % 60
        $strPasado = "+{0:D2}:{1:D2}" -f $mPasado, $sPasado
        Write-Host -NoNewline "`r⚠️ [TIEMPO TRANSCURRIDO SIN REACTIVAR]: $strPasado  (Presiona cualquier tecla)  " -ForegroundColor Red
        Start-Sleep -Seconds 1
        $tiempoPasado++
    }

    # Limpiar buffer de teclado
    while ([Console]::KeyAvailable) { [void][Console]::ReadKey($true) }
    Write-Host "`n🔁 ¡Reactivado! Iniciando nuevo ciclo...`n" -ForegroundColor Green
    Write-Host ("-" * 50)
}
