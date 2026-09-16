export const EXPENSE_CATEGORIES = [
  { value: "software", label: "Software & Tools", icon: "💻", color: "hsl(250, 80%, 60%)" },
  { value: "equipment", label: "Equipment & Gear", icon: "🎥", color: "hsl(200, 80%, 55%)" },
  { value: "travel", label: "Travel & Transport", icon: "✈️", color: "hsl(170, 70%, 45%)" },
  { value: "workspace", label: "Workspace & Rent", icon: "🏠", color: "hsl(30, 80%, 55%)" },
  { value: "marketing", label: "Marketing & Ads", icon: "📢", color: "hsl(340, 75%, 55%)" },
  { value: "education", label: "Education & Courses", icon: "📚", color: "hsl(280, 70%, 55%)" },
  { value: "subscriptions", label: "Subscriptions", icon: "🔄", color: "hsl(220, 75%, 55%)" },
  { value: "food", label: "Food & Meals", icon: "🍕", color: "hsl(15, 80%, 55%)" },
  { value: "insurance", label: "Insurance & Health", icon: "🛡️", color: "hsl(140, 60%, 45%)" },
  { value: "taxes", label: "Taxes & Fees", icon: "📋", color: "hsl(0, 60%, 50%)" },
  { value: "contractors", label: "Contractors & Help", icon: "🤝", color: "hsl(50, 75%, 50%)" },
  { value: "entertainment", label: "Entertainment", icon: "🎬", color: "hsl(300, 65%, 55%)" },
  { value: "carnival", label: "Carnival & Fêtes", icon: "🎭", color: "hsl(330, 80%, 55%)" },
  { value: "events", label: "Events & Production", icon: "🎪", color: "hsl(260, 70%, 55%)" },
  { value: "other", label: "Other", icon: "📦", color: "hsl(210, 15%, 55%)" },
] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number]["value"];

export const getCategoryInfo = (value: string) =>
  EXPENSE_CATEGORIES.find((c) => c.value === value) || EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
