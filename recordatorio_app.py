"""
App de Recordatorio Sonoro en Segundo Plano con Contador de Tiempo Transcurrido
Autor: Antigravity Assistant
"""

import sys
import time
import threading
import tkinter as tk
from tkinter import ttk
import winsound

class ReminderApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Recordatorio Sonoro ⏰")
        self.root.geometry("440x580")
        self.root.minsize(400, 540)
        self.root.configure(bg="#181825")

        # Variables de estado
        self.state = "IDLE"  # "IDLE", "COUNTING", "PAUSED", "OVERDUE"
        self.total_seconds = 5 * 60
        self.remaining_seconds = self.total_seconds
        self.overdue_seconds = 0
        self.sound_count = 0
        self.always_on_top = tk.BooleanVar(value=False)
        self.show_popup = tk.BooleanVar(value=True)
        self.repeat_beep = tk.BooleanVar(value=False)
        
        # Sonido seleccionado
        self.sound_choice = tk.StringVar(value="Melodía Suave")

        self._setup_ui()
        self._update_display()

    def _setup_ui(self):
        style = ttk.Style()
        style.theme_use('clam')
        style.configure("TCombobox", fieldbackground="#313244", background="#45475a", foreground="#cdd6f4")

        # Header
        header_frame = tk.Frame(self.root, bg="#1e1e2e", pady=12)
        header_frame.pack(fill="x")

        title_lbl = tk.Label(
            header_frame, 
            text="⏰ RECORDATORIO CÍCLICO", 
            font=("Segoe UI", 14, "bold"), 
            fg="#89b4fa", 
            bg="#1e1e2e"
        )
        title_lbl.pack()

        subtitle_lbl = tk.Label(
            header_frame, 
            text="Alarma sonora + Conteo de tiempo transcurrido", 
            font=("Segoe UI", 9), 
            fg="#a6adc8", 
            bg="#1e1e2e"
        )
        subtitle_lbl.pack()

        # Contenedor principal
        main_frame = tk.Frame(self.root, bg="#181825", padx=20, pady=15)
        main_frame.pack(fill="both", expand=True)

        # Reloj Display
        self.clock_frame = tk.Frame(main_frame, bg="#11111b", bd=2, relief="groove", pady=12)
        self.clock_frame.pack(fill="x", pady=(0, 12))

        self.lbl_timer_tag = tk.Label(
            self.clock_frame,
            text="TIEMPO RESTANTE",
            font=("Segoe UI", 8, "bold"),
            fg="#89b4fa",
            bg="#11111b"
        )
        self.lbl_timer_tag.pack()

        self.lbl_time = tk.Label(
            self.clock_frame, 
            text="05:00", 
            font=("Consolas", 42, "bold"), 
            fg="#a6e3a1", 
            bg="#11111b"
        )
        self.lbl_time.pack()

        self.lbl_status = tk.Label(
            self.clock_frame, 
            text="Listo para iniciar", 
            font=("Segoe UI", 9, "italic"), 
            fg="#bac2de", 
            bg="#11111b"
        )
        self.lbl_status.pack()

        # Configuración de Intervalo
        config_frame = tk.LabelFrame(
            main_frame, 
            text=" ⚙️ Configurar Intervalo ", 
            font=("Segoe UI", 10, "bold"), 
            fg="#fab387", 
            bg="#181825", 
            padx=10, 
            pady=8
        )
        config_frame.pack(fill="x", pady=(0, 10))

        time_inputs_frame = tk.Frame(config_frame, bg="#181825")
        time_inputs_frame.pack(fill="x")

        tk.Label(time_inputs_frame, text="Minutos:", font=("Segoe UI", 10), fg="#cdd6f4", bg="#181825").grid(row=0, column=0, padx=5, sticky="w")
        self.spin_minutes = tk.Spinbox(time_inputs_frame, from_=0, to=180, width=5, font=("Segoe UI", 10, "bold"), justify="center", bg="#313244", fg="#ffffff", insertbackground="white")
        self.spin_minutes.delete(0, "end")
        self.spin_minutes.insert(0, "5")
        self.spin_minutes.grid(row=0, column=1, padx=(0, 15))

        tk.Label(time_inputs_frame, text="Segundos:", font=("Segoe UI", 10), fg="#cdd6f4", bg="#181825").grid(row=0, column=2, padx=5, sticky="w")
        self.spin_seconds = tk.Spinbox(time_inputs_frame, from_=0, to=59, width=5, font=("Segoe UI", 10, "bold"), justify="center", bg="#313244", fg="#ffffff", insertbackground="white")
        self.spin_seconds.delete(0, "end")
        self.spin_seconds.insert(0, "0")
        self.spin_seconds.grid(row=0, column=3, padx=(0, 5))

        # Configuración de Sonido
        sound_frame = tk.LabelFrame(
            main_frame, 
            text=" 🔔 Tipo de Sonido ", 
            font=("Segoe UI", 10, "bold"), 
            fg="#cba6f7", 
            bg="#181825", 
            padx=10, 
            pady=8
        )
        sound_frame.pack(fill="x", pady=(0, 10))

        sounds_row = tk.Frame(sound_frame, bg="#181825")
        sounds_row.pack(fill="x")

        sound_combo = ttk.Combobox(
            sounds_row, 
            textvariable=self.sound_choice, 
            values=["Melodía Suave", "Campana Ascendente", "Doble Beep", "Windows Alerta", "Beep Continuo"], 
            state="readonly", 
            width=20,
            font=("Segoe UI", 9)
        )
        sound_combo.pack(side="left", padx=(0, 10), fill="x", expand=True)

        btn_test_sound = tk.Button(
            sounds_row, 
            text="🔊 Probar", 
            font=("Segoe UI", 9, "bold"), 
            bg="#45475a", 
            fg="#cdd6f4", 
            activebackground="#585b70", 
            activeforeground="#ffffff", 
            bd=0, 
            padx=10, 
            pady=3, 
            cursor="hand2", 
            command=self.test_sound
        )
        btn_test_sound.pack(side="right")

        # Opciones
        options_frame = tk.Frame(main_frame, bg="#181825")
        options_frame.pack(fill="x", pady=(0, 10))

        chk_top = tk.Checkbutton(
            options_frame, 
            text="📌 Siempre al frente", 
            variable=self.always_on_top, 
            command=self._toggle_top, 
            font=("Segoe UI", 8), 
            fg="#cdd6f4", 
            bg="#181825", 
            selectcolor="#313244", 
            activebackground="#181825", 
            activeforeground="#ffffff"
        )
        chk_top.grid(row=0, column=0, sticky="w")

        chk_popup = tk.Checkbutton(
            options_frame, 
            text="💬 Traer al frente al sonar", 
            variable=self.show_popup, 
            font=("Segoe UI", 8), 
            fg="#cdd6f4", 
            bg="#181825", 
            selectcolor="#313244", 
            activebackground="#181825", 
            activeforeground="#ffffff"
        )
        chk_popup.grid(row=0, column=1, sticky="w", padx=(10, 0))

        # Botones de Acción
        self.btn_container = tk.Frame(main_frame, bg="#181825")
        self.btn_container.pack(fill="x", pady=(5, 5))

        self.btn_toggle = tk.Button(
            self.btn_container, 
            text="▶ INICIAR", 
            font=("Segoe UI", 11, "bold"), 
            bg="#a6e3a1", 
            fg="#11111b", 
            activebackground="#94e2d5", 
            activeforeground="#11111b", 
            bd=0, 
            pady=10, 
            cursor="hand2", 
            command=self.toggle_action
        )
        self.btn_toggle.pack(side="left", fill="x", expand=True, padx=(0, 5))

        self.btn_reset = tk.Button(
            self.btn_container, 
            text="⏹ REINICIAR", 
            font=("Segoe UI", 11, "bold"), 
            bg="#f38ba8", 
            fg="#11111b", 
            activebackground="#eba0ac", 
            activeforeground="#11111b", 
            bd=0, 
            pady=10, 
            cursor="hand2", 
            command=self.reset_timer
        )
        self.btn_reset.pack(side="right", fill="x", expand=True, padx=(5, 0))

        # Footer con estadísticas
        self.lbl_stats = tk.Label(
            main_frame, 
            text="Recordatorios sonados: 0", 
            font=("Segoe UI", 8), 
            fg="#6c7086", 
            bg="#181825", 
            pady=5
        )
        self.lbl_stats.pack(side="bottom")

    def _toggle_top(self):
        self.root.attributes("-topmost", self.always_on_top.get())

    def _play_selected_sound(self):
        choice = self.sound_choice.get()
        try:
            if choice == "Melodía Suave":
                notes = [(523, 120), (659, 120), (784, 140), (1046, 250)]
                for freq, dur in notes:
                    winsound.Beep(freq, dur)
                    time.sleep(0.02)
            elif choice == "Campana Ascendente":
                notes = [(440, 100), (554, 100), (659, 100), (880, 300)]
                for freq, dur in notes:
                    winsound.Beep(freq, dur)
                    time.sleep(0.01)
            elif choice == "Doble Beep":
                winsound.Beep(880, 150)
                time.sleep(0.1)
                winsound.Beep(880, 200)
            elif choice == "Windows Alerta":
                winsound.MessageBeep(winsound.MB_ICONEXCLAMATION)
            elif choice == "Beep Continuo":
                for _ in range(3):
                    winsound.Beep(1000, 150)
                    time.sleep(0.08)
            else:
                winsound.MessageBeep(winsound.MB_OK)
        except Exception:
            try:
                winsound.MessageBeep()
            except:
                pass

    def test_sound(self):
        threading.Thread(target=self._play_selected_sound, daemon=True).start()

    def _get_configured_seconds(self):
        try:
            mins = int(self.spin_minutes.get())
            secs = int(self.spin_seconds.get())
            total = mins * 60 + secs
            return max(1, total)
        except ValueError:
            return 5 * 60

    def toggle_action(self):
        if self.state == "IDLE":
            # Iniciar conteo regresivo
            self.total_seconds = self._get_configured_seconds()
            self.remaining_seconds = self.total_seconds
            self.overdue_seconds = 0
            self.state = "COUNTING"
            self._update_ui_state()
            self._timer_tick()

        elif self.state == "COUNTING":
            # Pausar
            self.state = "PAUSED"
            self._update_ui_state()

        elif self.state == "PAUSED":
            # Reanudar
            self.state = "COUNTING"
            self._update_ui_state()
            self._timer_tick()

        elif self.state == "OVERDUE":
            # Estaba en tiempo transcurrido y el usuario hizo clic en "Reactivar"
            self.total_seconds = self._get_configured_seconds()
            self.remaining_seconds = self.total_seconds
            self.overdue_seconds = 0
            self.state = "COUNTING"
            self._update_ui_state()
            self._timer_tick()

    def reset_timer(self):
        self.state = "IDLE"
        self.total_seconds = self._get_configured_seconds()
        self.remaining_seconds = self.total_seconds
        self.overdue_seconds = 0
        self._update_ui_state()

    def _update_ui_state(self):
        if self.state == "IDLE":
            self.lbl_timer_tag.config(text="TIEMPO CONFIGURADO", fg="#89b4fa")
            self.lbl_time.config(fg="#a6e3a1")
            self.lbl_status.config(text="Listo para iniciar", fg="#bac2de")
            self.btn_toggle.config(text="▶ INICIAR", bg="#a6e3a1", fg="#11111b")
            self._update_display()

        elif self.state == "COUNTING":
            self.lbl_timer_tag.config(text="⏱ TIEMPO RESTANTE (CUENTA REGRESIVA)", fg="#89b4fa")
            self.lbl_time.config(fg="#a6e3a1")
            self.lbl_status.config(text="En ejecución (segundo plano activo)", fg="#a6e3a1")
            self.btn_toggle.config(text="⏸ PAUSAR", bg="#f9e2af", fg="#11111b")

        elif self.state == "PAUSED":
            self.lbl_timer_tag.config(text="⏸ EN PAUSA", fg="#fab387")
            self.lbl_time.config(fg="#fab387")
            self.lbl_status.config(text="Temporizador pausado", fg="#fab387")
            self.btn_toggle.config(text="▶ CONTINUAR", bg="#a6e3a1", fg="#11111b")

        elif self.state == "OVERDUE":
            self.lbl_timer_tag.config(text="⚠️ TIEMPO PASADO DESDE QUE SONÓ (+)", fg="#f38ba8")
            self.lbl_time.config(fg="#f38ba8")
            self.lbl_status.config(text="¡Sonó la alarma! Esperando reactivación...", fg="#f38ba8")
            self.btn_toggle.config(text="🔁 REACTIVAR (NUEVO CICLO)", bg="#89b4fa", fg="#11111b")

    def _timer_tick(self):
        if self.state == "COUNTING":
            if self.remaining_seconds > 0:
                self.remaining_seconds -= 1
                self._update_display()
                self.root.after(1000, self._timer_tick)
            else:
                # Llegó a 0 -> SONAR y pasar a modo OVERDUE (Tiempo transcurrido)
                self._on_time_reached()

        elif self.state == "OVERDUE":
            self.overdue_seconds += 1
            self._update_display()
            self.root.after(1000, self._timer_tick)

    def _on_time_reached(self):
        self.sound_count += 1
        self.lbl_stats.config(text=f"Recordatorios sonados: {self.sound_count}")
        
        # Reproducir sonido
        threading.Thread(target=self._play_selected_sound, daemon=True).start()

        # Cambiar a estado OVERDUE
        self.state = "OVERDUE"
        self.overdue_seconds = 0
        self._update_ui_state()
        self._update_display()

        # Traer ventana al frente si está configurado
        if self.show_popup.get():
            try:
                self.root.deiconify()
                self.root.lift()
                self.root.attributes("-topmost", True)
                if not self.always_on_top.get():
                    self.root.after(2500, lambda: self.root.attributes("-topmost", False))
            except:
                pass

        # Iniciar conteo de tiempo transcurrido
        self.root.after(1000, self._timer_tick)

    def _update_display(self):
        if self.state == "OVERDUE":
            mins = self.overdue_seconds // 60
            secs = self.overdue_seconds % 60
            self.lbl_time.config(text=f"+{mins:02d}:{secs:02d}")
            self.lbl_status.config(
                text=f"⏰ Sonó hace {mins}m {secs}s sin reactivar",
                fg="#f38ba8"
            )
        else:
            mins = self.remaining_seconds // 60
            secs = self.remaining_seconds % 60
            self.lbl_time.config(text=f"{mins:02d}:{secs:02d}")

def main():
    root = tk.Tk()
    app = ReminderApp(root)
    root.mainloop()

if __name__ == "__main__":
    main()
