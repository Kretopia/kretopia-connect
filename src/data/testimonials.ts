// Collected testimonials — will be displayed on the landing page once we have 3+
export interface Testimonial {
  name: string;
  role: string;
  avatarUrl?: string;
  quote: string;
  location?: string;
}

export const testimonials: Testimonial[] = [
  {
    name: "Dee",
    role: "Creative",
    quote: "I like the overall concept, I think it would help a lot of creatives.",
  },
  // Add more testimonials here — aim for 3 before displaying on landing page
];
