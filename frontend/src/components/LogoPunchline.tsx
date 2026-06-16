interface LogoPunchlineProps {
  className?: string;
  size?: number;
}

export function LogoPunchline({ className = '', size = 5 }: LogoPunchlineProps) {
  return (
    <img
      src="/logo_punchline.svg"
      alt="CockpitAI Logo Punchline"
      className={`h-${size} w-${size} ${className}`}
    />
  );
}

export default LogoPunchline;
