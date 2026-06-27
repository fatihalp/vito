import { Head, useForm, usePage } from '@inertiajs/react';
import Layout from '@/layouts/app/layout';
import { Workflow } from '@/types/workflow';
import { useAppearance } from '@/hooks/use-appearance';
import {
  ReactFlow,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type FitViewOptions,
  type OnNodesChange,
  type OnEdgesChange,
  type OnNodeDrag,
  type DefaultEdgeOptions,
  Position,
  Background,
  Controls,
  BackgroundVariant,
  MarkerType,
  Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useEffect, useState } from 'react';
import CustomNode from './components/custom-node';
import { toast } from 'sonner';
import { WorkflowAction } from '@/types/workflow-action';
import Actions from './components/actions';
import { Button } from '@/components/ui/button';
import { DotIcon, LoaderCircleIcon, SaveIcon, TrashIcon, UploadIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import DeleteWorkflow from './components/delete-workflow';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

type Page = {
  workflow: Workflow;
  actions: {
    [key: string]: WorkflowAction;
  };
};

type WorkflowImport = {
  name?: string;
  nodes: Node[];
  edges: Edge[];
};

const fitViewOptions: FitViewOptions = {
  padding: 0.2,
};

const defaultEdgeOptions: DefaultEdgeOptions = {
  animated: true,
  type: 'smoothstep',
  markerStart: MarkerType.Arrow,
  markerEnd: MarkerType.ArrowClosed,
};

const onNodeDrag: OnNodeDrag = (_, node) => {
  console.log('drag event', node.data);
};

export default function Show() {
  const page = usePage<Page>();
  const { getActualAppearance } = useAppearance();
  const [nodes, setNodes] = useState<Node[]>(page.props.workflow.nodes);
  const [edges, setEdges] = useState<Edge[]>(page.props.workflow.edges);
  const [importOpen, setImportOpen] = useState(false);
  const [importDomain, setImportDomain] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);

  useEffect(() => {
    form.setData('nodes', JSON.parse(JSON.stringify(nodes)));
    form.setData('edges', JSON.parse(JSON.stringify(edges)));
  }, [nodes, edges]);

  const form = useForm<{
    name: string;
    nodes: string;
    edges: string;
  }>({
    name: page.props.workflow.name,
    nodes: JSON.parse(JSON.stringify(page.props.workflow.nodes)),
    edges: JSON.parse(JSON.stringify(page.props.workflow.edges)),
  });

  const onNodesChange: OnNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), [setNodes]);
  const onEdgesChange: OnEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), [setEdges]);

  const wouldCreateLoop = (edges: Edge[], source: string, target: string): boolean => {
    if (source === target) return true; // direct self-loop

    const visited = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      if (nodeId === source) return true; // found a cycle
      visited.add(nodeId);

      const outgoing = edges.filter((e) => e.source === nodeId);
      for (const e of outgoing) {
        if (!visited.has(e.target) && dfs(e.target)) {
          return true;
        }
      }
      return false;
    };

    return dfs(target);
  };

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      if (wouldCreateLoop(edges, connection.source, connection.target)) {
        toast.error('Connection would create a loop.');
        return;
      }

      const colors = {
        success: 'oklch(51.1% 0.262 276.966)',
        failure: '',
      };

      const outgoingEdges = edges.filter((edge) => edge.source === connection.source);
      const hasSuccess = outgoingEdges.some((e) => e.style?.stroke === colors.success);
      const hasFailure = outgoingEdges.some((e) => e.style?.stroke === colors.failure);

      if (outgoingEdges.length >= 2) {
        toast.error('This node already has 2 outgoing edges (1 success and 1 failure).');
        return;
      }

      let color: 'success' | 'failure';
      if (!hasSuccess) {
        color = 'success';
      } else if (!hasFailure) {
        color = 'failure';
      } else {
        toast.error('This node already has 2 outgoing edges (1 success and 1 failure).');
        return;
      }

      const newEdge: Edge = {
        ...connection,
        id: `${connection.source}-${connection.target}-${colors[color]}`,
        data: { status: color },
        style: { stroke: colors[color], strokeWidth: 2 },
        markerEnd: { type: 'arrowclosed', color: colors[color] },
      };

      setEdges((eds) => {
        const updated = addEdge(newEdge, eds);
        return [...updated].sort((a, b) => {
          if (a.style?.stroke === colors.success && b.style?.stroke === colors.failure) return 1;
          if (a.style?.stroke === colors.failure && b.style?.stroke === colors.success) return -1;
          return 0;
        });
      });
    },
    [edges, setEdges],
  );

  const onActionAdded = (action: WorkflowAction) => {
    const newNode: Node = {
      id: action.id,
      type: 'custom',
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: { label: action.label, action: action },
      position: { x: 0, y: 0 },
    };
    console.log('New node added:', newNode);
    // append node
    setNodes((nds) => nds.concat(newNode));
  };

  const saveWorkflow = () => {
    form.put(route('workflows.update', page.props.workflow.id));
  };

  const normalizeDomain = (value: string) => {
    const withProtocol = value.match(/^https?:\/\//) ? value : `https://${value}`;
    const hostname = new URL(withProtocol).hostname.replace(/^www\./, '').toLowerCase();

    if (!/^[a-z0-9.-]+$/.test(hostname)) {
      throw new Error('Invalid domain');
    }

    return hostname;
  };

  const replaceTokens = (value: unknown, tokens: Record<string, string>): unknown => {
    if (typeof value === 'string') {
      return Object.entries(tokens).reduce((text, [token, replacement]) => text.replaceAll(token, replacement), value);
    }

    if (Array.isArray(value)) {
      return value.map((item) => replaceTokens(item, tokens));
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceTokens(item, tokens)]));
    }

    return value;
  };

  const importWorkflow = async () => {
    if (!importFile) {
      toast.error('Select a workflow JSON file.');
      return;
    }

    let domain: string;
    try {
      domain = normalizeDomain(importDomain);
    } catch {
      toast.error('Enter a valid site address.');
      return;
    }

    const baseName = domain.split('.')[0] || 'site';
    const siteUser = domain
      .replace(/[^a-z0-9]/g, '')
      .replace(/^[^a-z]+/, '')
      .slice(0, 32);
    const databaseName = baseName.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 63);
    const appName = baseName.charAt(0).toUpperCase() + baseName.slice(1);
    const databasePassword = Array.from(crypto.getRandomValues(new Uint8Array(24)), (byte) => byte.toString(36))
      .join('')
      .slice(0, 32);

    try {
      const template = JSON.parse(await importFile.text()) as WorkflowImport;
      const imported = replaceTokens(template, {
        '__DOMAIN__': domain,
        '__APP_URL__': `https://${domain}`,
        '__APP_NAME__': appName,
        '__SITE_USER__': siteUser,
        '__DATABASE_NAME__': databaseName,
        '__DATABASE_USERNAME__': databaseName,
        '__DATABASE_PASSWORD__': databasePassword,
      }) as WorkflowImport;

      if (!Array.isArray(imported.nodes) || !Array.isArray(imported.edges)) {
        toast.error('Invalid workflow JSON file.');
        return;
      }

      const formattedNodes = imported.nodes.map((node, index) => ({
        ...node,
        position: node.position || { x: index * 360, y: 0 },
      }));

      setNodes(formattedNodes);
      setEdges(imported.edges);
      if (imported.name) {
        form.setData('name', imported.name.replace('__DOMAIN__', domain));
      }
      setImportOpen(false);
      toast.success('Workflow imported. Save changes to persist it.');
    } catch {
      toast.error('Could not import workflow JSON.');
    }
  };

  return (
    <Layout>
      <Head title={`Workflow - ${page.props.workflow.name}`} />
      <div className="bg-accent relative h-full w-full border-none">
        <div className="bg-background absolute top-0 left-0 z-10 m-2 flex items-center justify-between gap-2 rounded-lg border p-3">
          <h2 className="text-lg font-semibold tracking-tight">{`Workflow - ${page.props.workflow.name}`}</h2>
          <DotIcon />
          <Button variant="ghost" className="size-7" onClick={saveWorkflow} disabled={form.processing}>
            {form.processing ? <LoaderCircleIcon className="animate-spin" /> : <SaveIcon />}
          </Button>
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" className="size-7">
                <UploadIcon />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import Workflow</DialogTitle>
                <DialogDescription>Enter the site address and select a workflow JSON template.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 p-4">
                <div className="grid gap-2">
                  <Label htmlFor="import-domain">Site Address</Label>
                  <Input
                    id="import-domain"
                    value={importDomain}
                    placeholder="alobot.net"
                    onChange={(event) => setImportDomain(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="import-file">Workflow JSON</Label>
                  <Input
                    id="import-file"
                    type="file"
                    accept="application/json,.json"
                    onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" onClick={importWorkflow}>
                  Import
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <DeleteWorkflow workflow={page.props.workflow}>
            <Button variant="ghost" className="size-7">
              <TrashIcon />
            </Button>
          </DeleteWorkflow>
          <DotIcon />
          <Badge variant="default">Beta</Badge>
        </div>
        <Actions actions={page.props.actions} onActionAdded={onActionAdded} />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDrag={onNodeDrag}
          snapToGrid={true}
          snapGrid={[50, 50]}
          fitView
          fitViewOptions={fitViewOptions}
          defaultEdgeOptions={defaultEdgeOptions}
          colorMode={getActualAppearance()}
          nodeTypes={{
            custom: CustomNode,
          }}
        >
          <Background variant={BackgroundVariant.Dots} />
          <Controls position="bottom-right" />
        </ReactFlow>
      </div>
    </Layout>
  );
}
