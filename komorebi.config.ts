import {
  aboutLink,
  archiveLink,
  blogLink,
  defineConfig,
  friendsLink,
  homeLink,
} from 'komorebi-theme';

export default defineConfig({
  title: 'Jeremiah',
  tagline: 'CTFer',
  locale: 'zh-CN',
  pagination: {
    pageSize: 4,
  },
  home: {
    eyebrow: '安静的人',
    title: 'Jeremiah',
    description: '记录 Android 安全、游戏安全与 CTF 相关内容。',
  },
  nav: [homeLink(), blogLink(), archiveLink(), friendsLink(), aboutLink()],
  friends: [
    {
      name: 'GamerNoTitle',
      url: 'https://bili33.top',
      avatar: 'https://assets.bili33.top/img/AboutMe/logo-mini.png',
      description: 'TECH OTAKUS SAVE THE WORLD',
    },
    {
      name: 'Rusty',
      url: 'https://blog.rusty1e.top/',
      avatar: 'https://blog.rusty1e.top/image/avatar.png',
      description: 'Search Engines Enjoyer',
    },
    {
      name: 'RON#1337',
      url: 'https://blog.zzpeng.com/',
      avatar: 'https://blog.zzpeng.com/img/avatar.jpg',
      description: 'Make Script Kiddies Great Again',
    },
    {
      name: 'lrhtony',
      url: 'https://lrhtony.cn/',
      avatar: 'https://jks.moe/avatar',
      description: '面向 wp 逆向',
    },
    {
      name: 'unknown',
      url: 'https://unk.org.cn/',
      avatar: 'https://avatars.githubusercontent.com/u/112916014?v=4',
      description: '真正的大师永远怀着一颗学徒的心',
    },
    {
      name: '時雨てる',
      url: 'https://keqing.moe/',
      avatar: 'https://keqing.moe/res/avatar.png',
      description: '心有所向，日复一日，必有精进',
    },
  ],
});
