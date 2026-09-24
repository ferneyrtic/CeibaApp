"""
Script CLI de Recordatorio con Conteo de Tiempo Transcurrido tras la Alarma
"""
import time
import sys
import threading
import winsound

def play_sound():
    try:
        notes = [(523, 120), (659, 120), (784, 140), (1046, 250)]
        for freq, dur in notes:
            winsound.Beep(freq, dur)
            time.sleep(0.02)
    except:
        winsound.MessageBeep()

def wait_for_enter(stop_event):
    input()
    stop_event.set()

def main():
    interval_minutes = 5
    if len(sys.argv) > 1:
        try:
            interval_minutes = float(sys.argv[1])
        except ValueError:
            pass

    seconds = int(interval_minutes * 60)
    print("=" * 60)
    print(f"🔔 RECORDATORIO CON CRONÓMETRO DE TIEMPO TRANSCURRIDO")
    print(f"⏰ Temporizador configurado en: {interval_minutes} minutos.")
    print("👉 Presiona Ctrl + C para salir.")
    print("=" * 60)

    alarm_count = 0
    try:
        while True:
            # 1. Cuenta Regresiva
            for remaining in range(seconds, 0, -1):
                mins = remaining // 60
                secs = remaining % 60
                sys.stdout.write(f"\r⏳ [CUENTA REGRESIVA] Falta: {mins:02d}:{secs:02d} | Ciclos completados: {alarm_count}   ")
                sys.stdout.flush()
                time.sleep(1)

            # 2. Sonar Alarma
            alarm_count += 1
            hora_alarma = time.strftime('%H:%M:%S')
            play_sound()
            print(f"\n\n🔔 [¡ALARMA #{alarm_count} SONADA A LAS {hora_alarma}!] 🔔")
            print("👉 Presiona [ENTER] en cualquier momento para REACTIVAR el ciclo.")

            # 3. Conteo hacia adelante (tiempo transcurrido desde que sonó)
            stop_event = threading.Event()
            input_thread = threading.Thread(target=wait_for_enter, args=(stop_event,), daemon=True)
            input_thread.start()

            overdue_sec = 0
            while not stop_event.is_set():
                m = overdue_sec // 60
                s = overdue_sec % 60
                sys.stdout.write(f"\r⚠️  [TIEMPO TRANSCURRIDO SIN REACTIVAR]: +{m:02d}:{s:02d}  (Presiona ENTER para reiniciar)  ")
                sys.stdout.flush()
                time.sleep(1)
                overdue_sec += 1

            print(f"\n🔁 ¡Reactivado tras +{overdue_sec//60:02d}:{overdue_sec%60:02d}! Iniciando nuevo ciclo...\n")
            print("-" * 60)

    except KeyboardInterrupt:
        print("\n\n⏹ Recordatorio detenido. ¡Hasta luego!")

if __name__ == "__main__":
    main()
