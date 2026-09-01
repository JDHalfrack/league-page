import { managers as configuredManagers } from '$lib/utils/leagueInfo';

export const buildManagers = (leagueTeamManagers) => {
    if (!leagueTeamManagers?.users) return configuredManagers || [];

    const autoManagers = Object.values(leagueTeamManagers.users).map(user => {
        const configured =
            configuredManagers.find(
                manager => manager.managerID === user.user_id
            ) || {};

        let photo = '/managers/question.jpg';

        if (user.avatar) {
            photo = `https://sleepercdn.com/avatars/thumbs/${user.avatar}`;
        }

        return {
            managerID: user.user_id,

            // Sleeper defaults
            name:
                configured.name ||
                user.display_name ||
                user.user_name ||
                'Unknown Manager',

            photo: configured.photo || photo,

            // Optional manual fields
            tookOver: configured.tookOver ?? null,
            location: configured.location ?? null,
            bio: configured.bio ?? null,
            fantasyStart: configured.fantasyStart ?? null,
            favoriteTeam: configured.favoriteTeam ?? null,
            mode: configured.mode ?? null,
            rival: configured.rival ?? null,
            favoritePlayer: configured.favoritePlayer ?? null,
            valuePosition: configured.valuePosition ?? null,
            rookieOrVets: configured.rookieOrVets ?? null,
            philosophy: configured.philosophy ?? null,
            tradingScale: configured.tradingScale ?? null,
            preferredContact: configured.preferredContact ?? null
        };
    });

    return autoManagers;
};
