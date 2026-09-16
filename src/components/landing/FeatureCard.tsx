interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
}

export const FeatureCard = ({ icon, title, description, gradient }: FeatureCardProps) => {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-8 shadow-card transition-smooth hover:-translate-y-2 hover:shadow-glow hover:border-primary/20">
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-smooth group-hover:opacity-100" />
      
      <div className={`relative mb-5 inline-flex rounded-xl bg-gradient-to-br ${gradient} p-4 text-primary-foreground shadow-card transition-smooth group-hover:scale-110 group-hover:shadow-glow`}>
        {icon}
      </div>
      
      <h3 className="relative mb-3 text-xl font-semibold transition-smooth group-hover:text-primary">{title}</h3>
      <p className="relative text-sm leading-relaxed text-muted-foreground">{description}</p>
      
      {/* Animated corner accent */}
      <div className="absolute top-0 right-0 h-20 w-20 translate-x-10 -translate-y-10 rounded-full bg-primary/10 blur-2xl transition-smooth group-hover:translate-x-5 group-hover:-translate-y-5" />
    </div>
  );
};
