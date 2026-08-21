<p align="center">
    <img alt="VitoDeploy" src="https://github.com/user-attachments/assets/f477ab88-8e1c-474e-8238-bf5892b2840f">
    <p align="center">
        <a href="https://github.com/vitodeploy/vito/actions"><img alt="GitHub Workflow Status" src="https://github.com/vitodeploy/vito/workflows/tests/badge.svg"></a>
    </p>
</p>

------

## About Vito

Vito is a self-hosted web application that helps you manage your servers and deploy your PHP applications into
production servers without a hassle.

## Quick Start

```sh
bash <(curl -Ls https://raw.githubusercontent.com/vitodeploy/vito/4.x/scripts/install.sh)
```

## Updating Vito

Before updating, back up `/home/vito/storage` and `/home/vito/vito/.env`. For Docker installations,
back up the application volumes instead. Review the [4.x breaking changes](docs/4.x/prologue/breaking-changes.md)
before upgrading across major versions.

For a standard VPS installation, connect over SSH as the `vito` user, not `root`, and run the bundled updater:

```sh
cd /home/vito/vito
bash scripts/update.sh
```

The updater switches to the latest stable release, installs production Composer dependencies, runs database
migrations, rebuilds Laravel caches, restarts the queue and WebSocket workers, and runs post-update tasks. It also
discards local changes in the Vito directory, so preserve any intentional customization before running it.

For Docker installations, pull the current `latest` image and recreate the application containers using the same
Compose configuration and volumes. See the complete [4.x upgrade guide](docs/4.x/prologue/upgrade.md) for Docker,
major-version, beta/RC, and recovery instructions.

## Features

- Provisions and Manages the server
- Easy database management, Supports Mysql and MariaDB
- Deploy your PHP applications such as Laravel
- Manage your server's firewall
- Supports Custom and Letsencrypt SSL
- Uses supervisor to handle queues
- Manages server's services
- Deploy your SSH Keys to the server
- Create and Manage cron jobs on the server
- API
- Plugins
- Export and Import
- Workflows and Automations
- Domains and DNS Management

## Modern Deployment Default Scripts

When [Modern Deployment](https://vitodeploy.com/docs/sites/modern-deployment) (zero-downtime deployments with
rollback support) is enabled on a standard Laravel site, Vito seeds the **Build** and **Pre-flight** scripts with
the following defaults:

Build script — builds resources before the release is swapped in:

```sh
composer install --no-interaction --prefer-dist --optimize-autoloader

npm ci
npm run build
```

Pre-flight script — runs right before the release goes live:

```sh
php artisan migrate --force

php artisan optimize:clear
php artisan optimize
```

Both scripts are fully editable per site from the Application page.

## Useful Links

- [Documentation](https://vitodeploy.com)
- [Install on Server](https://vitodeploy.com/getting-started/installation.html#install-on-vps)
- [Install via Docker](https://vitodeploy.com/getting-started/installation.html#install-via-docker)
- [Roadmap](https://github.com/orgs/vitodeploy/projects/5)
- [Discord](https://discord.gg/uZeeHZZnm5)
- [Contribution](https://vitodeploy.com/prologue/contribution-guide.html)
- [Security](/SECURITY.md)

## Credits

- Laravel
- InertiaJS
- ReactJS
- Shadcn UI
- PHPSecLib
- Pest
- Tailwindcss
- Vite
- Prettier
- Spatie
- Opcodesio log viewer
- Tightenco
- InertiaTables (Forjedio)

## Powered by

[![JetBrains logo.](https://resources.jetbrains.com/storage/products/company/brand/logos/jetbrains.svg)](https://jb.gg/OpenSource)
