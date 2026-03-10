export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "ARHM's SPACE",
  description: "Arhm's personal space on a random server somewhere on the earth, where you will get to know me.",
  mainsite: "https://space.arhm.dev",
  
  navItems: [
    {
      label: "Home",
      href: "/",
    },
    {
      label: "Good stuff",
      href: "/goodstuff",
    },
    {
      label: "Xtras",
      href: "/xtras",
    },
    {
      label: "Favourites",
      href: "favourites",
    },
    {
      label: "whoami",
      href: "/",
    },
    {
      label: "Blog",
      href: "https://blog.arhm.dev",
    }
  ],

  links: {
    portfolio: "https://arhm.dev/",
  },
};
