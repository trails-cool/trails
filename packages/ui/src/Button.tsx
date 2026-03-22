import type { ButtonHTMLAttributes } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
}

const variantStyles = {
  primary: "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800",
  secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200 active:bg-gray-300",
  ghost: "text-gray-700 hover:bg-gray-100 active:bg-gray-200",
};

const sizeStyles = {
  sm: "px-2.5 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    />
  );
}
