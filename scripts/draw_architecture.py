import matplotlib.pyplot as plt
import matplotlib.patches as patches

def draw_architecture():
    fig, ax = plt.subplots(figsize=(13, 8))
    ax.set_xlim(0, 13)
    ax.set_ylim(0, 8)
    ax.axis('off')

    # Color Palette
    color_user = '#E3F2FD'     # Light Blue
    color_cf_bg = '#FAFAFA'    # Very Light Grey
    color_routing = '#E1F5FE'  # Light Blue for Edge Routing
    color_static = '#F1F8E9'   # Light Green
    color_worker = '#FFF3E0'   # Light Orange
    color_do = '#F3E5F5'       # Light Purple
    color_db = '#E0F2F1'       # Light Teal
    color_build = '#ECEFF1'    # Light Grey
    color_edge = '#455A64'     # Blue Grey

    # Helper function for drawing rounded rectangles
    def add_rounded_rect(x, y, w, h, text, color, text_color='#000000', subtext=None, subtext_color='#5D4037', fontsize=11, fontweight='bold', zorder=10, linestyle='-'):
        rect = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.1", 
                                      facecolor=color, edgecolor=color_edge, lw=1.5, zorder=zorder, linestyle=linestyle)
        ax.add_patch(rect)
        
        cx = x + w/2
        cy = y + h/2
        
        if subtext:
             ax.text(cx, cy + 0.15, text, ha='center', va='center', fontsize=fontsize, fontweight=fontweight, color=text_color, zorder=zorder+1)
             ax.text(cx, cy - 0.25, subtext, ha='center', va='center', fontsize=9, color=subtext_color, zorder=zorder+1)
        else:
             ax.text(cx, cy, text, ha='center', va='center', fontsize=fontsize, fontweight=fontweight, color=text_color, zorder=zorder+1)

    # 1. User
    add_rounded_rect(0.5, 3.5, 1.8, 1, "User", color_user, subtext="(Browser)", text_color='#37474F')


    # 2. Build Process (Outside)
    ax.text(1.4, 7.5, "Build Phase", fontsize=10, color='#78909C', fontweight='bold', ha='center')
    add_rounded_rect(0.5, 6.2, 1.8, 0.8, "Templates", color_build, fontsize=9, fontweight='normal', linestyle='--')
    
    # Build Arrow to Worker
    ax.annotate('Build & Bundle', xy=(5.5, 5.0), xytext=(1.4, 6.2), 
                arrowprops=dict(arrowstyle='->', lw=1.2, color='#CFD8DC', connectionstyle="arc3,rad=0.2"), 
                fontsize=8, color='#546E7A', ha='center')


    # 3. Cloudflare Platform Boundary
    platform_rect = patches.FancyBboxPatch((3.0, 0.5), 9.5, 7.0, boxstyle="round,pad=0.2",
                                           facecolor=color_cf_bg, edgecolor='#B0BEC5', linestyle='--', lw=1, zorder=1)
    ax.add_patch(platform_rect)
    ax.text(3.3, 7.2, "Cloudflare Platform", fontsize=10, color='#78909C', fontweight='bold', zorder=2)


    # 4. Cloudflare Edge / Routing
    add_rounded_rect(3.5, 2.5, 1.5, 3.0, "Edge\nNetwork", color_routing, subtext="(Routing)", fontsize=10)
    
    
    # 5. Static Assets Service
    add_rounded_rect(5.8, 5.5, 2.5, 1.0, "Static Assets", color_static, subtext="(CDN / Assets)", text_color='#33691E')


    # 6. Worker (Hono App)
    worker_bg = patches.FancyBboxPatch((5.8, 1.5), 2.5, 3.2, boxstyle="round,pad=0.1", 
                                      facecolor=color_worker, edgecolor=color_edge, lw=1.5, zorder=10)
    ax.add_patch(worker_bg)
    ax.text(7.05, 4.4, "Worker (Hono)", ha='center', va='center', fontsize=11, fontweight='bold', color='#E65100', zorder=11)
    
    # Worker Internals
    add_rounded_rect(6.0, 3.5, 2.1, 0.6, "Logic / Auth", '#FFE0B2', fontsize=9, fontweight='normal', zorder=12)
    add_rounded_rect(6.0, 2.7, 2.1, 0.6, "Templates (JS)", '#FFCCBC', fontsize=9, fontweight='normal', zorder=12)
    add_rounded_rect(6.0, 1.9, 2.1, 0.6, "Digits (SVG)", '#FFCCBC', fontsize=9, fontweight='normal', zorder=12)


    # 7. Durable Objects Group
    do_group = patches.FancyBboxPatch((9.0, 1.0), 3.2, 6.0, boxstyle="round,pad=0.1",
                                      facecolor='none', edgecolor=color_edge, linestyle=':', lw=1, zorder=5)
    ax.add_patch(do_group)
    ax.text(10.6, 6.7, "Durable Objects", ha='center', va='center', fontsize=10, fontweight='bold', color='#4A148C')

    # DO 1: Counter
    add_rounded_rect(9.3, 4.9, 2.6, 1.1, "", color_do, text_color='#4A148C')
    ax.text(9.9, 5.45, "Counter", ha='center', va='center', fontsize=10, fontweight='bold', color='#4A148C', zorder=16)
    add_rounded_rect(10.8, 5.0, 0.8, 0.9, "SQLite", color_db, fontsize=8, fontweight='normal', text_color='#00695C', zorder=15)

    # DO 2: BBS
    add_rounded_rect(9.3, 3.2, 2.6, 1.1, "", color_do, text_color='#4A148C')
    ax.text(9.9, 3.75, "BBS", ha='center', va='center', fontsize=10, fontweight='bold', color='#4A148C', zorder=16)
    add_rounded_rect(10.8, 3.3, 0.8, 0.9, "SQLite", color_db, fontsize=8, fontweight='normal', text_color='#00695C', zorder=15)

    # DO 3: Diary
    add_rounded_rect(9.3, 1.5, 2.6, 1.1, "", color_do, text_color='#4A148C')
    ax.text(9.9, 2.05, "Diary", ha='center', va='center', fontsize=10, fontweight='bold', color='#4A148C', zorder=16)
    add_rounded_rect(10.8, 1.6, 0.8, 0.9, "SQLite", color_db, fontsize=8, fontweight='normal', text_color='#00695C', zorder=15)


    # 8. Arrows (Flow)
    arrow_props = dict(arrowstyle='->', lw=1.5, color='#455A64')
    
    # User -> Edge
    ax.annotate('', xy=(3.5, 4.0), xytext=(2.3, 4.0), arrowprops=arrow_props, zorder=20)
    
    # Edge -> Static Assets
    ax.annotate('Static', xy=(5.8, 6.0), xytext=(5.0, 4.5), 
                arrowprops=dict(arrowstyle='->', lw=1.5, color='#33691E', connectionstyle="arc3,rad=-0.1"), 
                fontsize=9, color='#33691E', zorder=20)
    
    # Edge -> Worker
    ax.annotate('Dynamic', xy=(5.8, 3.5), xytext=(5.0, 3.5), 
                arrowprops=dict(arrowstyle='->', lw=1.5, color='#E65100'), 
                fontsize=9, color='#E65100', zorder=20)
    
    # Worker -> DO Counter
    ax.annotate('', xy=(9.3, 5.45), xytext=(8.3, 4.0), 
                arrowprops=dict(arrowstyle='->', lw=1.5, color='#455A64', connectionstyle="arc3,rad=0.1"), zorder=20)
    
    # Worker -> DO BBS
    ax.annotate('', xy=(9.3, 3.75), xytext=(8.3, 3.5), 
                arrowprops=dict(arrowstyle='->', lw=1.5, color='#455A64', connectionstyle="arc3,rad=0.1"), zorder=20)
    
    # Worker -> DO Diary
    ax.annotate('', xy=(9.3, 2.05), xytext=(8.3, 3.0), 
                arrowprops=dict(arrowstyle='->', lw=1.5, color='#455A64', connectionstyle="arc3,rad=-0.1"), zorder=20)

    plt.tight_layout()
    plt.savefig('docs/images/architecture.png', dpi=300, bbox_inches='tight')

if __name__ == "__main__":
    draw_architecture()