import { useState } from 'react';
import { Badge, PageHead } from '../components/ui';
import { ResourceHub, type ResourceView } from '../features/resources/ResourceHub';
import { DemoOpportunitiesPage } from './DemoOpportunitiesPage';

export function OpportunitiesPage() {
  const [view, setView] = useState<ResourceView | 'Demo examples'>('Discover TMU');
  return (
    <>
      <PageHead
        eyebrow="THE OPPORTUNITY HUB"
        title="Your skills can open doors."
        description="Find paid work, meet your next mentor, or take the first step with a Zone."
        action={
          <Badge tone={view === 'Demo examples' ? 'amber' : 'green'}>
            {view === 'Demo examples' ? 'Illustrative listings' : 'Official TMU resources'}
          </Badge>
        }
      />
      <div className="resource-navigation tabs" role="group" aria-label="Opportunity hub views">
        {(['Discover TMU', 'My shortlist', 'TMU zones', 'Demo examples'] as const).map((tab) => (
          <button
            key={tab}
            className={view === tab ? 'selected' : ''}
            aria-pressed={view === tab}
            onClick={() => setView(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      {view === 'Demo examples' ? (
        <DemoOpportunitiesPage />
      ) : (
        <ResourceHub view={view} onView={setView} />
      )}
    </>
  );
}
