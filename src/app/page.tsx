import { PotchaApp } from '@/components/app/potcha-app';
import { Providers } from '@/components/app/providers';

export default function Home() {
  return (
    <Providers>
      <PotchaApp />
    </Providers>
  );
}
