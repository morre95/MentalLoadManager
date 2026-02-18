--
-- PostgreSQL database dump
--

\restrict h2ZozMIYj700KfnFDexNewbjxtjHoDZNsG6AH7GlHGCHVbaL7aHT1VnXdY68Qd2

-- Dumped from database version 17.7 (Debian 17.7-3.pgdg13+1)
-- Dumped by pg_dump version 17.8 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ai_summaries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_summaries (
    ai_summary_id uuid DEFAULT gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    week_start date,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    model character varying(100),
    prompt_hash text
);


ALTER TABLE public.ai_summaries OWNER TO postgres;

--
-- Name: calendar_connections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.calendar_connections (
    calendar_id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    provider character varying(50) NOT NULL,
    calendar_ext_id text NOT NULL,
    summary text,
    timezone text DEFAULT 'UTC'::text,
    is_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.calendar_connections OWNER TO postgres;

--
-- Name: categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categories (
    category_id uuid DEFAULT gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    name character varying(100) NOT NULL
);


ALTER TABLE public.categories OWNER TO postgres;

--
-- Name: contact_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contact_messages (
    contact_message_id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    name character varying(200) NOT NULL,
    email character varying(320) NOT NULL,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.contact_messages OWNER TO postgres;

--
-- Name: daily_reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.daily_reports (
    daily_report_id uuid DEFAULT gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    date date NOT NULL,
    granted_at timestamp with time zone DEFAULT now(),
    stats_json jsonb,
    summary text
);


ALTER TABLE public.daily_reports OWNER TO postgres;

--
-- Name: households; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.households (
    household_id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(200) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.households OWNER TO postgres;

--
-- Name: invitations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invitations (
    invitation_id uuid DEFAULT gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    code character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    created_by uuid
);


ALTER TABLE public.invitations OWNER TO postgres;

--
-- Name: monthly_reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.monthly_reports (
    monthly_report_id uuid DEFAULT gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    month_start date NOT NULL,
    month_end date NOT NULL,
    granted_at timestamp with time zone DEFAULT now(),
    stats_json jsonb,
    summary text
);


ALTER TABLE public.monthly_reports OWNER TO postgres;

--
-- Name: oauth_accounts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.oauth_accounts (
    oauth_accounts_id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    provider character varying(50) NOT NULL,
    provider_user_id character varying(255) NOT NULL,
    email character varying(255),
    access_token text,
    refresh_token text,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.oauth_accounts OWNER TO postgres;

--
-- Name: preferences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.preferences (
    user_id uuid NOT NULL,
    weekly_digest_enabled boolean DEFAULT false NOT NULL,
    monthly_digest_enabled boolean DEFAULT false NOT NULL,
    reminder_minutes_default integer DEFAULT 60 NOT NULL,
    timezone text DEFAULT 'UTC'::text
);


ALTER TABLE public.preferences OWNER TO postgres;

--
-- Name: reminders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reminders (
    reminder_id uuid DEFAULT gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    user_id uuid NOT NULL,
    minutes_before_due integer DEFAULT 60 NOT NULL,
    active boolean DEFAULT true NOT NULL
);


ALTER TABLE public.reminders OWNER TO postgres;

--
-- Name: task_attachment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_attachment (
    task_attachment_id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    url text,
    file text,
    type character varying(50)
);


ALTER TABLE public.task_attachment OWNER TO postgres;

--
-- Name: task_calendar_links; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_calendar_links (
    task_link_id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    connection_id uuid NOT NULL,
    provider_event_id text,
    created_at timestamp with time zone DEFAULT now(),
    last_synced_at timestamp with time zone,
    prompt_hash text,
    sync_status character varying(50) DEFAULT 'NOT_SYNCED'::character varying,
    sync_error text
);


ALTER TABLE public.task_calendar_links OWNER TO postgres;

--
-- Name: tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tasks (
    task_id uuid DEFAULT gen_random_uuid() NOT NULL,
    due_date timestamp with time zone,
    name character varying(255) NOT NULL,
    description text,
    status character varying(50) NOT NULL,
    priority character varying(50),
    category_id uuid,
    complete_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    assigns_to uuid,
    created_by uuid,
    started_at timestamp with time zone,
    household_id uuid NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    "order" integer,
    CONSTRAINT tasks_status_check CHECK (((status)::text = ANY ((ARRAY['todo'::character varying, 'in_progress'::character varying, 'done'::character varying, 'on_hold'::character varying])::text[])))
);


ALTER TABLE public.tasks OWNER TO postgres;

--
-- Name: user_task; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_task (
    user_id uuid NOT NULL,
    task_id uuid NOT NULL
);


ALTER TABLE public.user_task OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    user_id uuid DEFAULT gen_random_uuid() NOT NULL,
    username character varying(100) NOT NULL,
    password character varying(255),
    email character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    last_login timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now(),
    display_name character varying(100)
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_households; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users_households (
    user_id uuid NOT NULL,
    household_id uuid NOT NULL
);


ALTER TABLE public.users_households OWNER TO postgres;

--
-- Name: weekly_reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.weekly_reports (
    weekly_report_id uuid DEFAULT gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    week_start date NOT NULL,
    week_end date NOT NULL,
    granted_at timestamp with time zone DEFAULT now(),
    stats_json jsonb,
    summary text
);


ALTER TABLE public.weekly_reports OWNER TO postgres;

--
-- Data for Name: ai_summaries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ai_summaries (ai_summary_id, household_id, week_start, content, created_at, model, prompt_hash) FROM stdin;
b9b8b7b6-1111-1111-1111-111111111111	b1b2b3b4-1111-1111-1111-111111111111	2026-02-07	Denna vecka har familjen Svensson-Johansson gjort stora framsteg på renoveringen av vardagsrummet. Erik har målat två väggar och Anna har hanterat barnrelaterade sysslor effektivt. Hämtningar på dagis har fungerat smidigt enligt schema. Shopping-uppgiften för helgen är prioriterad.	2026-02-14 15:09:26.784531+00	gpt-4	hash_abc123
b9b8b7b6-2222-2222-2222-222222222222	b1b2b3b4-3333-3333-3333-333333333333	2026-02-07	Kollektivet på Södermalm har haft en fungerande vecka med rotationsschemat för matlagning. Karin lagade vegetarisk lasagne som uppskattades av alla. Städningen av gemensamma ytor är schemalagd och diskmaskinens reparation är bokad för nästa vecka.	2026-02-14 15:09:26.784531+00	gpt-4	hash_xyz789
\.


--
-- Data for Name: calendar_connections; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.calendar_connections (calendar_id, user_id, provider, calendar_ext_id, summary, timezone, is_enabled, created_at, updated_at) FROM stdin;
d1d2d3d4-1111-1111-1111-111111111111	a1b2c3d4-1111-1111-1111-111111111111	google	primary	Anna - Primär kalender	Europe/Stockholm	t	2026-02-14 15:09:26.4814+00	2026-02-14 15:09:26.4814+00
d1d2d3d4-2222-2222-2222-222222222222	a1b2c3d4-2222-2222-2222-222222222222	google	primary	Erik - Primär kalender	Europe/Stockholm	t	2026-02-14 15:09:26.4814+00	2026-02-14 15:09:26.4814+00
d1d2d3d4-3333-3333-3333-333333333333	a1b2c3d4-1111-1111-1111-111111111111	google	family@group.calendar.google.com	Familjekalender	Europe/Stockholm	t	2026-02-14 15:09:26.4814+00	2026-02-14 15:09:26.4814+00
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.categories (category_id, household_id, name) FROM stdin;
e1e2e3e4-1111-1111-1111-111111111111	b1b2b3b4-1111-1111-1111-111111111111	Hushåll
e1e2e3e4-2222-2222-2222-222222222222	b1b2b3b4-1111-1111-1111-111111111111	Barnrelaterat
e1e2e3e4-3333-3333-3333-333333333333	b1b2b3b4-1111-1111-1111-111111111111	Renovering
e1e2e3e4-4444-4444-4444-444444444444	b1b2b3b4-1111-1111-1111-111111111111	Shopping
e1e2e3e4-5555-5555-5555-555555555555	b1b2b3b4-2222-2222-2222-222222222222	Städning
e1e2e3e4-6666-6666-6666-666666666666	b1b2b3b4-2222-2222-2222-222222222222	Trädgård
e1e2e3e4-7777-7777-7777-777777777777	b1b2b3b4-2222-2222-2222-222222222222	Ekonomi
e1e2e3e4-8888-8888-8888-888888888888	b1b2b3b4-3333-3333-3333-333333333333	Matlagning
e1e2e3e4-9999-9999-9999-999999999999	b1b2b3b4-3333-3333-3333-333333333333	Städning
e1e2e3e4-aaaa-aaaa-aaaa-aaaaaaaaaaaa	b1b2b3b4-3333-3333-3333-333333333333	Inköp
\.


--
-- Data for Name: contact_messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.contact_messages (contact_message_id, user_id, name, email, message, created_at) FROM stdin;
\.


--
-- Data for Name: daily_reports; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.daily_reports (daily_report_id, household_id, date, granted_at, stats_json, summary) FROM stdin;
e1e2e3e4-1111-1111-1111-111111111111	b1b2b3b4-1111-1111-1111-111111111111	2026-02-13	2026-02-14 15:09:26.702549+00	{"active_users": 2, "tasks_created": 1, "tasks_completed": 2}	Bra dag! 2 uppgifter slutförda.
e1e2e3e4-2222-2222-2222-222222222222	b1b2b3b4-2222-2222-2222-222222222222	2026-02-13	2026-02-14 15:09:26.702549+00	{"active_users": 2, "tasks_created": 2, "tasks_completed": 1}	Städning genomförd, två nya uppgifter tillagda.
\.


--
-- Data for Name: households; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.households (household_id, name, created_at, updated_at) FROM stdin;
b1b2b3b4-1111-1111-1111-111111111111	Familjen Svensson-Johansson	2026-01-15 15:09:26.372065+00	2026-02-14 15:09:26.372065+00
b1b2b3b4-2222-2222-2222-222222222222	Anderssonshuset	2026-01-25 15:09:26.372065+00	2026-02-14 15:09:26.372065+00
b1b2b3b4-3333-3333-3333-333333333333	Kollektivet Södermalm	2026-01-30 15:09:26.372065+00	2026-02-14 15:09:26.372065+00
\.


--
-- Data for Name: invitations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.invitations (invitation_id, household_id, code, created_at, expires_at, created_by) FROM stdin;
c1c2c3c4-1111-1111-1111-111111111111	b1b2b3b4-1111-1111-1111-111111111111	FAMILY2024ABC	2026-02-14 15:09:26.647836+00	2026-02-21 15:09:26.647836+00	a1b2c3d4-1111-1111-1111-111111111111
c1c2c3c4-2222-2222-2222-222222222222	b1b2b3b4-2222-2222-2222-222222222222	ANDERSSON2024XYZ	2026-02-14 15:09:26.647836+00	2026-02-28 15:09:26.647836+00	a1b2c3d4-3333-3333-3333-333333333333
c1c2c3c4-3333-3333-3333-333333333333	b1b2b3b4-3333-3333-3333-333333333333	KOLLEKTIV2024QRS	2026-02-14 15:09:26.647836+00	2026-03-16 15:09:26.647836+00	a1b2c3d4-5555-5555-5555-555555555555
\.


--
-- Data for Name: monthly_reports; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.monthly_reports (monthly_report_id, household_id, month_start, month_end, granted_at, stats_json, summary) FROM stdin;
a9a8a7a6-1111-1111-1111-111111111111	b1b2b3b4-1111-1111-1111-111111111111	2026-01-01	2026-01-31	2026-02-14 15:09:26.757599+00	{"tasks_created": 38, "categories_used": 4, "completion_rate": 0.84, "tasks_completed": 32, "avg_completion_days": 2.5}	Stark månad med 84% slutförandegrad. Renoveringsprojektet går framåt.
\.


--
-- Data for Name: oauth_accounts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.oauth_accounts (oauth_accounts_id, user_id, provider, provider_user_id, email, access_token, refresh_token, expires_at, created_at, updated_at) FROM stdin;
c1c2c3c4-1111-1111-1111-111111111111	a1b2c3d4-1111-1111-1111-111111111111	google	112233445566778899	anna.svensson@gmail.com	ya29.a0AfH6SMBx...	\N	2026-02-14 16:09:26.454052+00	2026-02-14 15:09:26.454052+00	2026-02-14 15:09:26.454052+00
c1c2c3c4-2222-2222-2222-222222222222	a1b2c3d4-2222-2222-2222-222222222222	google	223344556677889900	erik.johansson@gmail.com	ya29.a0AfH6SMBy...	\N	2026-02-14 16:09:26.454052+00	2026-02-14 15:09:26.454052+00	2026-02-14 15:09:26.454052+00
\.


--
-- Data for Name: preferences; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.preferences (user_id, weekly_digest_enabled, monthly_digest_enabled, reminder_minutes_default, timezone) FROM stdin;
a1b2c3d4-1111-1111-1111-111111111111	t	t	60	Europe/Stockholm
a1b2c3d4-2222-2222-2222-222222222222	t	f	30	Europe/Stockholm
a1b2c3d4-3333-3333-3333-333333333333	f	t	120	Europe/Stockholm
a1b2c3d4-4444-4444-4444-444444444444	t	t	60	Europe/Stockholm
a1b2c3d4-5555-5555-5555-555555555555	f	f	15	Europe/Stockholm
\.


--
-- Data for Name: reminders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.reminders (reminder_id, household_id, user_id, minutes_before_due, active) FROM stdin;
d1d2d3d4-1111-1111-1111-111111111111	b1b2b3b4-1111-1111-1111-111111111111	a1b2c3d4-1111-1111-1111-111111111111	60	t
d1d2d3d4-2222-2222-2222-222222222222	b1b2b3b4-1111-1111-1111-111111111111	a1b2c3d4-2222-2222-2222-222222222222	30	t
d1d2d3d4-3333-3333-3333-333333333333	b1b2b3b4-2222-2222-2222-222222222222	a1b2c3d4-3333-3333-3333-333333333333	120	t
d1d2d3d4-4444-4444-4444-444444444444	b1b2b3b4-3333-3333-3333-333333333333	a1b2c3d4-5555-5555-5555-555555555555	15	t
\.


--
-- Data for Name: task_attachment; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.task_attachment (task_attachment_id, task_id, url, file, type) FROM stdin;
b1b2b3b4-1111-1111-1111-111111111111	f1f2f3f4-3333-3333-3333-333333333333	https://example.com/paint-color-sample.jpg	\N	image
b1b2b3b4-2222-2222-2222-222222222222	f1f2f3f4-3333-3333-3333-333333333333	https://example.com/room-measurements.pdf	\N	document
b1b2b3b4-3333-3333-3333-333333333333	f1f2f3f4-7777-7777-7777-777777777777	https://example.com/electricity-bill.pdf	\N	document
\.


--
-- Data for Name: task_calendar_links; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.task_calendar_links (task_link_id, task_id, connection_id, provider_event_id, created_at, last_synced_at, prompt_hash, sync_status, sync_error) FROM stdin;
a1a2a3a4-1111-1111-1111-111111111111	f1f2f3f4-2222-2222-2222-222222222222	d1d2d3d4-1111-1111-1111-111111111111	evt_123abc	2026-02-14 15:09:26.564645+00	2026-02-14 14:09:26.564645+00	\N	SYNCED	\N
a1a2a3a4-2222-2222-2222-222222222222	f1f2f3f4-3333-3333-3333-333333333333	d1d2d3d4-3333-3333-3333-333333333333	evt_456def	2026-02-14 15:09:26.564645+00	2026-02-10 15:09:26.564645+00	\N	SYNCED	\N
a1a2a3a4-3333-3333-3333-333333333333	f1f2f3f4-4444-4444-4444-444444444444	d1d2d3d4-1111-1111-1111-111111111111	\N	2026-02-14 15:09:26.564645+00	\N	\N	NOT_SYNCED	\N
\.


--
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tasks (task_id, due_date, name, description, status, priority, category_id, complete_date, created_at, assigns_to, created_by, started_at, household_id, updated_at, "order") FROM stdin;
f1f2f3f4-7777-7777-7777-777777777777	2026-02-18 15:09:26.535657+00	Betala elräkning	Förfaller 2024-02-15	todo	high	e1e2e3e4-7777-7777-7777-777777777777	\N	2026-02-11 15:09:26.535657+00	a1b2c3d4-3333-3333-3333-333333333333	a1b2c3d4-3333-3333-3333-333333333333	\N	b1b2b3b4-2222-2222-2222-222222222222	2026-02-14 15:09:26.535657+00	\N
f1f2f3f4-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-02-16 15:09:26.535657+00	Städa gemensamma ytor	Kök, vardagsrum, toalett	todo	medium	e1e2e3e4-9999-9999-9999-999999999999	\N	2026-02-13 15:09:26.535657+00	a1b2c3d4-2222-2222-2222-222222222222	a1b2c3d4-4444-4444-4444-444444444444	\N	b1b2b3b4-3333-3333-3333-333333333333	2026-02-14 15:09:26.535657+00	\N
f1f2f3f4-bbbb-bbbb-bbbb-bbbbbbbbbbbb	2026-02-17 15:09:26.535657+00	Handla toalettpapper och diskmedel	\N	todo	medium	e1e2e3e4-aaaa-aaaa-aaaa-aaaaaaaaaaaa	\N	2026-02-14 15:09:26.535657+00	a1b2c3d4-4444-4444-4444-444444444444	a1b2c3d4-2222-2222-2222-222222222222	\N	b1b2b3b4-3333-3333-3333-333333333333	2026-02-14 15:09:26.535657+00	\N
f1f2f3f4-cccc-cccc-cccc-cccccccccccc	2026-02-19 15:09:26.535657+00	Laga diskmaskin	Ringer tekniker	on_hold	high	e1e2e3e4-9999-9999-9999-999999999999	\N	2026-02-12 15:09:26.535657+00	a1b2c3d4-5555-5555-5555-555555555555	a1b2c3d4-5555-5555-5555-555555555555	\N	b1b2b3b4-3333-3333-3333-333333333333	2026-02-14 15:09:26.535657+00	\N
f1f2f3f4-4444-4444-4444-444444444444	2026-02-17 15:09:26.535657+00	Boka tandläkartid för barnen	\N	todo	medium	e1e2e3e4-2222-2222-2222-222222222222	\N	2026-02-12 15:09:26.535657+00	a1b2c3d4-1111-1111-1111-111111111111	a1b2c3d4-1111-1111-1111-111111111111	\N	b1b2b3b4-1111-1111-1111-111111111111	2026-02-18 17:57:14.855537+00	1
f1f2f3f4-5555-5555-5555-555555555555	2026-02-12 15:09:26.535657+00	Tvätta bilen	Bilvård invändigt och utvändigt	done	low	e1e2e3e4-1111-1111-1111-111111111111	2026-02-12 15:09:26.839297+00	2026-02-09 15:09:26.535657+00	a1b2c3d4-2222-2222-2222-222222222222	a1b2c3d4-2222-2222-2222-222222222222	\N	b1b2b3b4-1111-1111-1111-111111111111	2026-02-12 15:09:26.839297+00	\N
f1f2f3f4-9999-9999-9999-999999999999	2026-02-14 19:09:26.535657+00	Laga middag (Torsdag)	Vegetarisk lasagne - 4 portioner	in_progress	high	e1e2e3e4-8888-8888-8888-888888888888	\N	2026-02-14 13:09:26.535657+00	a1b2c3d4-5555-5555-5555-555555555555	a1b2c3d4-5555-5555-5555-555555555555	2026-02-14 05:09:26.865694+00	b1b2b3b4-3333-3333-3333-333333333333	2026-02-14 05:09:26.865694+00	\N
f1f2f3f4-8888-8888-8888-888888888888	2026-02-13 15:09:26.535657+00	Dammsuга källaren	\N	done	low	e1e2e3e4-5555-5555-5555-555555555555	2026-02-13 19:09:26.892118+00	2026-02-11 15:09:26.535657+00	a1b2c3d4-4444-4444-4444-444444444444	a1b2c3d4-3333-3333-3333-333333333333	\N	b1b2b3b4-2222-2222-2222-222222222222	2026-02-13 19:09:26.892118+00	\N
f2f2f2f2-2222-2222-2222-111111111111	2026-02-24 15:09:26.91865+00	Boka sotare	Kontroll av skorsten innan mars.	done	medium	e1e2e3e4-7777-7777-7777-777777777777	2026-02-12 15:09:26.91865+00	2026-02-09 15:09:26.91865+00	a1b2c3d4-3333-3333-3333-333333333333	a1b2c3d4-3333-3333-3333-333333333333	2026-02-10 15:09:26.91865+00	b1b2b3b4-2222-2222-2222-222222222222	2026-02-12 15:09:26.91865+00	\N
f2f2f2f2-2222-2222-2222-222222222222	2026-02-16 15:09:26.91865+00	Rensa hängrännor	Lövsäsong: kontrollera båda sidorna av huset.	todo	high	e1e2e3e4-6666-6666-6666-666666666666	\N	2026-01-24 15:09:26.91865+00	a1b2c3d4-4444-4444-4444-444444444444	a1b2c3d4-4444-4444-4444-444444444444	\N	b1b2b3b4-2222-2222-2222-222222222222	2026-01-24 15:09:26.91865+00	\N
f2f2f2f2-2222-2222-2222-333333333333	2026-02-19 15:09:26.91865+00	Budgetgenomgång	Gå igenom utgifter och sätt sparmål.	in_progress	medium	e1e2e3e4-7777-7777-7777-777777777777	\N	2026-02-08 15:09:26.91865+00	a1b2c3d4-3333-3333-3333-333333333333	a1b2c3d4-3333-3333-3333-333333333333	2026-02-13 15:09:26.91865+00	b1b2b3b4-2222-2222-2222-222222222222	2026-02-13 15:09:26.91865+00	\N
f2f2f2f2-2222-2222-2222-444444444444	2026-02-11 15:09:26.91865+00	Byta glödlampor i hallen	3 st spotlights.	todo	low	e1e2e3e4-5555-5555-5555-555555555555	\N	2026-02-03 15:09:26.91865+00	a1b2c3d4-4444-4444-4444-444444444444	a1b2c3d4-4444-4444-4444-444444444444	\N	b1b2b3b4-2222-2222-2222-222222222222	2026-02-03 15:09:26.91865+00	\N
f2f2f2f2-3333-3333-3333-111111111111	2026-02-20 15:09:26.91865+00	Planera matsedel (nästa vecka)	Förslag + inköpslista. Ta hänsyn till allergier.	todo	medium	e1e2e3e4-8888-8888-8888-888888888888	\N	2026-02-13 15:09:26.91865+00	a1b2c3d4-5555-5555-5555-555555555555	a1b2c3d4-5555-5555-5555-555555555555	\N	b1b2b3b4-3333-3333-3333-333333333333	2026-02-13 15:09:26.91865+00	\N
f2f2f2f2-3333-3333-3333-222222222222	2026-02-18 15:09:26.91865+00	Fixa cykelpump	Kontrollera ventil + köpa adapter om behövs.	in_progress	low	e1e2e3e4-aaaa-aaaa-aaaa-aaaaaaaaaaaa	\N	2026-02-06 15:09:26.91865+00	a1b2c3d4-2222-2222-2222-222222222222	a1b2c3d4-2222-2222-2222-222222222222	2026-02-12 15:09:26.91865+00	b1b2b3b4-3333-3333-3333-333333333333	2026-02-12 15:09:26.91865+00	\N
f2f2f2f2-3333-3333-3333-333333333333	2026-02-05 15:09:26.91865+00	Köpa diskborstar	2 st + svamp.	done	low	e1e2e3e4-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-02-12 15:09:26.91865+00	2026-01-29 15:09:26.91865+00	a1b2c3d4-4444-4444-4444-444444444444	a1b2c3d4-4444-4444-4444-444444444444	2026-02-08 15:09:26.91865+00	b1b2b3b4-3333-3333-3333-333333333333	2026-02-12 15:09:26.91865+00	\N
f2f2f2f2-3333-3333-3333-444444444444	2026-02-16 15:09:26.91865+00	Förnya internetavtal	Jämför pris och bindningstid.	on_hold	medium	e1e2e3e4-aaaa-aaaa-aaaa-aaaaaaaaaaaa	\N	2026-01-20 15:09:26.91865+00	a1b2c3d4-5555-5555-5555-555555555555	a1b2c3d4-4444-4444-4444-444444444444	\N	b1b2b3b4-3333-3333-3333-333333333333	2026-01-20 15:09:26.91865+00	\N
f1f2f3f4-3333-3333-3333-333333333333	2026-02-21 15:09:26.535657+00	Måla om vardagsrummet	Väggfärg köpt, behöver maskeringstejp och nya penslar	done	medium	e1e2e3e4-3333-3333-3333-333333333333	2026-02-15 14:24:03.870327+00	2026-02-09 15:09:26.535657+00	a1b2c3d4-2222-2222-2222-222222222222	a1b2c3d4-1111-1111-1111-111111111111	2026-02-10 15:09:26.812358+00	b1b2b3b4-1111-1111-1111-111111111111	2026-02-15 14:24:03.870327+00	\N
f2f2f2f2-1111-1111-1111-111111111111	2026-02-17 15:09:26.91865+00	Beställa vinteroverall	Kolla storlek och beställ innan helgen.	todo	medium	e1e2e3e4-2222-2222-2222-222222222222	\N	2026-02-12 15:09:26.91865+00	a1b2c3d4-1111-1111-1111-111111111111	a1b2c3d4-1111-1111-1111-111111111111	\N	b1b2b3b4-1111-1111-1111-111111111111	2026-02-18 17:57:14.855537+00	2
f2f2f2f2-1111-1111-1111-222222222222	2026-02-20 15:09:26.91865+00	Rensa förrådet	Sortera: släng/skänk/spara. Börja med hylla 1-2.	in_progress	high	e1e2e3e4-1111-1111-1111-111111111111	\N	2026-02-05 15:09:26.91865+00	a1b2c3d4-2222-2222-2222-222222222222	a1b2c3d4-2222-2222-2222-222222222222	2026-02-15 14:23:58.682779+00	b1b2b3b4-1111-1111-1111-111111111111	2026-02-15 14:24:13.451894+00	\N
f1f2f3f4-2222-2222-2222-222222222222	2026-02-14 21:09:26.535657+00	Hämta på dagis	Hämta Liam kl 16:30	on_hold	high	e1e2e3e4-2222-2222-2222-222222222222	\N	2026-02-14 03:09:26.535657+00	a1b2c3d4-1111-1111-1111-111111111111	a1b2c3d4-2222-2222-2222-222222222222	2026-02-15 14:23:39.53446+00	b1b2b3b4-1111-1111-1111-111111111111	2026-02-15 14:24:15.49547+00	\N
f2f2f2f2-1111-1111-1111-333333333333	2026-02-02 15:09:26.91865+00	Fixa trasig kökslåda	Skruva åt gångjärn + byt skruv om behövs.	done	low	e1e2e3e4-1111-1111-1111-111111111111	2026-02-15 14:24:18.26503+00	2026-01-27 15:09:26.91865+00	a1b2c3d4-2222-2222-2222-222222222222	a1b2c3d4-1111-1111-1111-111111111111	2026-02-15 14:24:18.26503+00	b1b2b3b4-1111-1111-1111-111111111111	2026-02-15 14:24:18.26503+00	\N
f1f2f3f4-6666-6666-6666-666666666666	2026-02-15 15:09:26.535657+00	Klippa gräsmattan	Främre och bakre gården	in_progress	high	e1e2e3e4-6666-6666-6666-666666666666	\N	2026-02-13 15:09:26.535657+00	a1b2c3d4-4444-4444-4444-444444444444	a1b2c3d4-3333-3333-3333-333333333333	2026-02-16 12:14:59.030643+00	b1b2b3b4-2222-2222-2222-222222222222	2026-02-16 12:14:59.030643+00	\N
f1f2f3f4-1111-1111-1111-111111111111	2026-10-29 23:00:00+00	Köpa mat till helgen	Handla: mjölk, bröd, pasta, kyckling, grönsaker	todo	low	e1e2e3e4-4444-4444-4444-444444444444	\N	2026-02-13 15:09:26.535657+00	a1b2c3d4-2222-2222-2222-222222222222	a1b2c3d4-1111-1111-1111-111111111111	\N	b1b2b3b4-1111-1111-1111-111111111111	2026-02-18 17:58:03.514787+00	0
f2f2f2f2-1111-1111-1111-444444444444	2026-02-15 15:09:26.91865+00	Ring försäkringsbolaget	Fråga om hemförsäkring och barnförsäkring.	done	medium	e1e2e3e4-1111-1111-1111-111111111111	2026-02-18 17:57:00.074578+00	2026-01-31 15:09:26.91865+00	a1b2c3d4-1111-1111-1111-111111111111	a1b2c3d4-2222-2222-2222-222222222222	2026-02-18 17:57:00.074578+00	b1b2b3b4-1111-1111-1111-111111111111	2026-02-18 17:57:00.074578+00	\N
\.


--
-- Data for Name: user_task; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_task (user_id, task_id) FROM stdin;
a1b2c3d4-2222-2222-2222-222222222222	f1f2f3f4-1111-1111-1111-111111111111
a1b2c3d4-1111-1111-1111-111111111111	f1f2f3f4-2222-2222-2222-222222222222
a1b2c3d4-2222-2222-2222-222222222222	f1f2f3f4-3333-3333-3333-333333333333
a1b2c3d4-4444-4444-4444-444444444444	f1f2f3f4-6666-6666-6666-666666666666
a1b2c3d4-5555-5555-5555-555555555555	f1f2f3f4-9999-9999-9999-999999999999
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (user_id, username, password, email, created_at, last_login, updated_at, display_name) FROM stdin;
a1b2c3d4-2222-2222-2222-222222222222	erik_johansson	$argon2id$v=19$m=65536,t=3,p=4$JOZVm9WlydNoZ+1P93jagw$sY+Fb6cf+KchVUl2xEVb838rxymuGT9QV3SvGGqlAzQ	erik.johansson@email.se	2026-01-20 15:09:26.342522+00	2026-02-14 13:09:26.342522+00	2026-02-14 15:09:26.342522+00	\N
a1b2c3d4-4444-4444-4444-444444444444	lars_nilsson	$argon2id$v=19$m=65536,t=3,p=4$JOZVm9WlydNoZ+1P93jagw$sY+Fb6cf+KchVUl2xEVb838rxymuGT9QV3SvGGqlAzQ	lars.nilsson@email.se	2026-01-30 15:09:26.342522+00	2026-02-14 10:09:26.342522+00	2026-02-14 15:09:26.342522+00	\N
a1b2c3d4-5555-5555-5555-555555555555	karin_berg	$argon2id$v=19$m=65536,t=3,p=4$JOZVm9WlydNoZ+1P93jagw$sY+Fb6cf+KchVUl2xEVb838rxymuGT9QV3SvGGqlAzQ	karin.berg@email.se	2026-02-04 15:09:26.342522+00	2026-02-14 14:09:26.342522+00	2026-02-14 15:09:26.342522+00	\N
a1b2c3d4-1111-1111-1111-111111111111	anna_svensson	$argon2id$v=19$m=65536,t=3,p=4$JOZVm9WlydNoZ+1P93jagw$sY+Fb6cf+KchVUl2xEVb838rxymuGT9QV3SvGGqlAzQ	anna.svensson@email.se	2026-01-15 15:09:26.342522+00	2026-02-18 17:56:10.48023+00	2026-02-14 15:09:26.342522+00	\N
a1b2c3d4-3333-3333-3333-333333333333	maria_andersson	$argon2id$v=19$m=65536,t=3,p=4$JOZVm9WlydNoZ+1P93jagw$sY+Fb6cf+KchVUl2xEVb838rxymuGT9QV3SvGGqlAzQ	maria.andersson@email.se	2026-01-25 15:09:26.342522+00	2026-02-18 18:33:04.060689+00	2026-02-14 15:09:26.342522+00	\N
\.


--
-- Data for Name: users_households; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users_households (user_id, household_id) FROM stdin;
a1b2c3d4-1111-1111-1111-111111111111	b1b2b3b4-1111-1111-1111-111111111111
a1b2c3d4-3333-3333-3333-333333333333	b1b2b3b4-2222-2222-2222-222222222222
a1b2c3d4-4444-4444-4444-444444444444	b1b2b3b4-2222-2222-2222-222222222222
a1b2c3d4-5555-5555-5555-555555555555	b1b2b3b4-3333-3333-3333-333333333333
a1b2c3d4-2222-2222-2222-222222222222	b1b2b3b4-3333-3333-3333-333333333333
a1b2c3d4-4444-4444-4444-444444444444	b1b2b3b4-3333-3333-3333-333333333333
\.


--
-- Data for Name: weekly_reports; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.weekly_reports (weekly_report_id, household_id, week_start, week_end, granted_at, stats_json, summary) FROM stdin;
f1f2f3f4-1111-1111-1111-111111111111	b1b2b3b4-1111-1111-1111-111111111111	2026-02-07	2026-02-14	2026-02-14 15:09:26.729955+00	{"tasks_created": 5, "completion_rate": 0.73, "tasks_completed": 8, "most_active_user": "Anna"}	Produktiv vecka med 73% slutförandegrad. Anna mest aktiv med 4 slutförda uppgifter.
f1f2f3f4-2222-2222-2222-222222222222	b1b2b3b4-3333-3333-3333-333333333333	2026-02-07	2026-02-14	2026-02-14 15:09:26.729955+00	{"tasks_created": 7, "completion_rate": 0.60, "tasks_completed": 6, "most_active_user": "Karin"}	Bra vecka i kollektivet. Matlagning och städning flöt på bra.
\.


--
-- Name: ai_summaries ai_summaries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_summaries
    ADD CONSTRAINT ai_summaries_pkey PRIMARY KEY (ai_summary_id);


--
-- Name: calendar_connections calendar_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calendar_connections
    ADD CONSTRAINT calendar_connections_pkey PRIMARY KEY (calendar_id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (category_id);


--
-- Name: contact_messages contact_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_messages
    ADD CONSTRAINT contact_messages_pkey PRIMARY KEY (contact_message_id);


--
-- Name: daily_reports daily_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_reports
    ADD CONSTRAINT daily_reports_pkey PRIMARY KEY (daily_report_id);


--
-- Name: households households_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.households
    ADD CONSTRAINT households_pkey PRIMARY KEY (household_id);


--
-- Name: invitations invitations_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_code_key UNIQUE (code);


--
-- Name: invitations invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_pkey PRIMARY KEY (invitation_id);


--
-- Name: monthly_reports monthly_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monthly_reports
    ADD CONSTRAINT monthly_reports_pkey PRIMARY KEY (monthly_report_id);


--
-- Name: oauth_accounts oauth_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.oauth_accounts
    ADD CONSTRAINT oauth_accounts_pkey PRIMARY KEY (oauth_accounts_id);


--
-- Name: oauth_accounts oauth_accounts_provider_provider_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.oauth_accounts
    ADD CONSTRAINT oauth_accounts_provider_provider_user_id_key UNIQUE (provider, provider_user_id);


--
-- Name: preferences preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.preferences
    ADD CONSTRAINT preferences_pkey PRIMARY KEY (user_id);


--
-- Name: reminders reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reminders
    ADD CONSTRAINT reminders_pkey PRIMARY KEY (reminder_id);


--
-- Name: task_attachment task_attachment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_attachment
    ADD CONSTRAINT task_attachment_pkey PRIMARY KEY (task_attachment_id);


--
-- Name: task_calendar_links task_calendar_links_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_calendar_links
    ADD CONSTRAINT task_calendar_links_pkey PRIMARY KEY (task_link_id);


--
-- Name: task_calendar_links task_calendar_links_task_id_connection_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_calendar_links
    ADD CONSTRAINT task_calendar_links_task_id_connection_id_key UNIQUE (task_id, connection_id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (task_id);


--
-- Name: user_task user_task_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_task
    ADD CONSTRAINT user_task_pkey PRIMARY KEY (user_id, task_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users_households users_households_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users_households
    ADD CONSTRAINT users_households_pkey PRIMARY KEY (user_id, household_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- Name: weekly_reports weekly_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.weekly_reports
    ADD CONSTRAINT weekly_reports_pkey PRIMARY KEY (weekly_report_id);


--
-- Name: idx_links_connection; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_links_connection ON public.task_calendar_links USING btree (connection_id);


--
-- Name: idx_tasks_assignee; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_assignee ON public.tasks USING btree (assigns_to);


--
-- Name: idx_tasks_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_category ON public.tasks USING btree (category_id);


--
-- Name: idx_tasks_group_due; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_group_due ON public.tasks USING btree (household_id, due_date);


--
-- Name: ai_summaries ai_summaries_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_summaries
    ADD CONSTRAINT ai_summaries_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(household_id) ON DELETE CASCADE;


--
-- Name: calendar_connections calendar_connections_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calendar_connections
    ADD CONSTRAINT calendar_connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: categories categories_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(household_id) ON DELETE CASCADE;


--
-- Name: contact_messages contact_messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_messages
    ADD CONSTRAINT contact_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE SET NULL;


--
-- Name: daily_reports daily_reports_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_reports
    ADD CONSTRAINT daily_reports_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(household_id) ON DELETE CASCADE;


--
-- Name: invitations invitations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id) ON DELETE SET NULL;


--
-- Name: invitations invitations_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(household_id) ON DELETE CASCADE;


--
-- Name: monthly_reports monthly_reports_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monthly_reports
    ADD CONSTRAINT monthly_reports_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(household_id) ON DELETE CASCADE;


--
-- Name: oauth_accounts oauth_accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.oauth_accounts
    ADD CONSTRAINT oauth_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: preferences preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.preferences
    ADD CONSTRAINT preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: reminders reminders_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reminders
    ADD CONSTRAINT reminders_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(household_id) ON DELETE CASCADE;


--
-- Name: reminders reminders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reminders
    ADD CONSTRAINT reminders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: task_attachment task_attachment_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_attachment
    ADD CONSTRAINT task_attachment_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(task_id) ON DELETE CASCADE;


--
-- Name: task_calendar_links task_calendar_links_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_calendar_links
    ADD CONSTRAINT task_calendar_links_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.calendar_connections(calendar_id) ON DELETE CASCADE;


--
-- Name: task_calendar_links task_calendar_links_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_calendar_links
    ADD CONSTRAINT task_calendar_links_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(task_id) ON DELETE CASCADE;


--
-- Name: tasks tasks_assigns_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_assigns_to_fkey FOREIGN KEY (assigns_to) REFERENCES public.users(user_id) ON DELETE SET NULL;


--
-- Name: tasks tasks_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(category_id) ON DELETE SET NULL;


--
-- Name: tasks tasks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id) ON DELETE SET NULL;


--
-- Name: tasks tasks_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(household_id) ON DELETE CASCADE;


--
-- Name: user_task user_task_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_task
    ADD CONSTRAINT user_task_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(task_id) ON DELETE CASCADE;


--
-- Name: user_task user_task_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_task
    ADD CONSTRAINT user_task_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: users_households users_households_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users_households
    ADD CONSTRAINT users_households_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(household_id) ON DELETE CASCADE;


--
-- Name: users_households users_households_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users_households
    ADD CONSTRAINT users_households_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: weekly_reports weekly_reports_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.weekly_reports
    ADD CONSTRAINT weekly_reports_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(household_id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict h2ZozMIYj700KfnFDexNewbjxtjHoDZNsG6AH7GlHGCHVbaL7aHT1VnXdY68Qd2

