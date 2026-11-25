// Stand-ins for npm:@react-email/components in tests (aliased in vitest.config.ts): plain elements, enough to read a template's text and links.
import * as React from "react";

type Props = { children?: React.ReactNode; href?: string; src?: string; alt?: string };
const block = ({ children }: Props) => <div>{children}</div>;
export const Html = block, Head = block, Body = block, Container = block, Heading = block, Text = block, Preview = block;
export const Link = ({ children, href }: Props) => <a href={href}>{children}</a>;
export const Button = Link;
export const Img = ({ src, alt }: Props) => <img src={src} alt={alt} />;
