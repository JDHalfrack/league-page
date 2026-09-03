import {leagueID} from '$lib/utils/leagueInfo';

export const tabs = [
    {
        icon: 'home',
        label: 'Home',
        dest: '/',
        key: 'home',
    },
    {
        icon: 'sports',
        label: 'Matchups',
        dest: '/matchups',
        key: 'matchups',
    },
    {
        icon: 'swap_horiz',
        label: 'Trades & Waivers',
        dest: '/transactions',
        key: 'transactions',
    },
    {
        icon: 'article',
        label: 'Blog',
        dest: '/blog',
        key: 'blog',
    },
    {
        icon: 'view_comfy',
        label: 'League Info',
        nest: true,
        key: 'league_info',
        children: [
            { icon: 'storage', label: 'Rosters', dest: '/rosters' },
            { icon: 'groups', label: 'Managers', dest: '/managers' },
            { icon: 'local_fire_department', label: 'Rivalry', dest: '/rivalry' },
            { icon: 'leaderboard', label: 'Standings', dest: '/standings' },
            { icon: 'view_comfy', label: 'Drafts', dest: '/drafts' },
            { icon: 'emoji_events', label: 'Trophy Room', dest: '/awards' },
            { icon: 'military_tech', label: 'Records', dest: '/records' },
            { icon: 'bolt', label: 'Impactful Games', dest: '/impact' },
            { icon: 'swap_calls', label: 'Trade Analyzer', dest: '/trade-analyzer' },
            { icon: 'hourglass_top', label: 'Keeper Tracker', dest: '/keeper-tracker' },
            { icon: 'history_edu', label: 'Constitution', dest: '/constitution' },
            {
                icon: 'sports_football',
                label: 'Go to Sleeper',
                dest: `https://sleeper.app/leagues/${leagueID}`,
            },
        ]
    },
    {
        icon: 'build',
        label: 'League Tools',
        nest: true,
        key: 'league_tools',
        children: [
            {
                icon: 'school',
                label: 'Future Prospects',
                dest: '/future-prospects',
            },
        ]
    },
    {
        icon: 'lightbulb',
        label: 'Resources',
        dest: '/resources',
        key: 'resources',
    },
];
