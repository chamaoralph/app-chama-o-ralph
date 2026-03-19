ALTER TABLE public.conversoes_offline 
ADD CONSTRAINT unique_gclid_conversion 
UNIQUE (gclid, conversion_name);