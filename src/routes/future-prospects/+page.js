export function load({ url }) {
    const currentYear = new Date().getFullYear();
    const defaultProspectClass = currentYear + 1;

    const requestedClass = Number(url.searchParams.get('class'));
    const legacyYear = Number(url.searchParams.get('year'));

    let prospectClass = defaultProspectClass;

    if (
        Number.isInteger(requestedClass) &&
        requestedClass >= 2011 &&
        requestedClass <= defaultProspectClass
    ) {
        prospectClass = requestedClass;
    } else if (
        Number.isInteger(legacyYear) &&
        legacyYear >= 2010 &&
        legacyYear <= currentYear
    ) {
        prospectClass = legacyYear + 1;
    }

    return {
        requestedClass: prospectClass
    };
}
