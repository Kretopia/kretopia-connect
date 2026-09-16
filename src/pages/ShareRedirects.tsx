import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

/**
 * Client-side fallback for /share/* routes.
 * The Vite build plugin generates static HTML share pages with OG meta tags,
 * but SPA fallback routing serves index.html instead on Lovable hosting.
 * These components redirect to the actual app pages.
 */

export const ShareGigRedirect = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  useEffect(() => {
    navigate(id ? `/opportunity/${id}` : "/", { replace: true });
  }, [id, navigate]);
  return null;
};

export const ShareProfileRedirect = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  useEffect(() => {
    navigate(id ? `/profile/${id}` : "/", { replace: true });
  }, [id, navigate]);
  return null;
};

export const ShareEventRedirect = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  useEffect(() => {
    navigate(id ? `/event/${id}` : "/", { replace: true });
  }, [id, navigate]);
  return null;
};

export const ShareMagazineRedirect = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  useEffect(() => {
    navigate(slug ? `/magazine/${slug}` : "/magazine", { replace: true });
  }, [slug, navigate]);
  return null;
};

export const ShareCampaignRedirect = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  useEffect(() => {
    navigate(slug ? `/fund/${slug}` : "/fund", { replace: true });
  }, [slug, navigate]);
  return null;
};
