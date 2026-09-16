-- Make project_id nullable so invoices can exist without a project
ALTER TABLE public.invoices ALTER COLUMN project_id DROP NOT NULL;

-- Also make issued_to nullable since standalone invoices use recipient_name/email instead
ALTER TABLE public.invoices ALTER COLUMN issued_to DROP NOT NULL;