"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * A password field with a show/hide toggle.
 *
 * Drop-in for a `<input type="password" .../>`: it forwards every standard input prop
 * (name, required, minLength, placeholder, autoComplete, defaultValue, ...) and adds an eye
 * button that flips the field between masked and plain text. The button is `tabIndex={-1}`
 * and `type="button"` so it never interrupts tab order or submits the form.
 *
 * `className` is applied to the input, so it matches whatever field it replaces. The wrapper
 * adds right padding to leave room for the button.
 */
export function PasswordInput({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input {...props} type={visible ? "text" : "password"} className={`${className} pr-11`} />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        title={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-neutral-400 transition hover:text-neutral-700 dark:hover:text-neutral-200"
      >
        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}
