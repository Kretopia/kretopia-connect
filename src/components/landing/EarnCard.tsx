interface EarnCardProps {
  icon: string;
  title: string;
  credits: string;
  description: string;
}

export const EarnCard = ({ icon, title, credits, description }: EarnCardProps) => {
  return (
    <div className="group rounded-2xl border border-border bg-card p-6 shadow-card transition-smooth hover:-translate-y-1 hover:shadow-glow hover:border-primary/20">
      <div className="mb-4 text-5xl transition-smooth group-hover:scale-110">{icon}</div>
      <h3 className="mb-3 text-lg font-semibold group-hover:text-primary transition-smooth">{title}</h3>
      <div className="mb-3 inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary shadow-sm">
        {credits}
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
};
