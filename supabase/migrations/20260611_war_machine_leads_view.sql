-- war_machine_leads — read alias for Marine Swarm pipeline (Agathon read-only)
CREATE OR REPLACE VIEW public.war_machine_leads AS
SELECT * FROM public.leads;

COMMENT ON VIEW public.war_machine_leads IS
  'Agathon read-only view of Marine Swarm leads; writes go through war_machine microservice';
